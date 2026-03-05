/**
 * SDKHost — Platform-side handler for app SDK requests.
 *
 * Uses Penpal v6 `connect()` + `WindowMessenger` to establish a connection
 * with an app running in an iframe, then routes SDK calls to the appropriate handler.
 */

import { connect, WindowMessenger, type Connection } from "penpal";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

// ─── Types (duplicated from SDK to avoid cross-package import) ─────

interface SDKResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: { code: string; message: string };
}

interface SDKEvent {
  type: string;
  payload: unknown;
}

interface AppMethods {
  handleEvent: (event: SDKEvent) => void;
}

// ─── Theme Reader ──────────────────────────────────────

function readThemeTokens() {
  const style = getComputedStyle(document.documentElement);
  const get = (name: string) => style.getPropertyValue(`--${name}`).trim();

  return {
    primary: `hsl(${get("primary")})`,
    primaryForeground: `hsl(${get("primary-foreground")})`,
    background: `hsl(${get("background")})`,
    foreground: `hsl(${get("foreground")})`,
    muted: `hsl(${get("muted")})`,
    mutedForeground: `hsl(${get("muted-foreground")})`,
    accent: `hsl(${get("accent")})`,
    accentForeground: `hsl(${get("accent-foreground")})`,
    border: `hsl(${get("border")})`,
    radius: get("radius"),
  };
}

// ─── Request Router ────────────────────────────────────

type Handler = (params?: Record<string, unknown>) => Promise<SDKResponse>;

const handlers: Record<string, Record<string, Handler>> = {
  user: {
    // user.getInfo is context-aware (needs appDbId for openid), handled in per-connection router

    async getAppToken(params) {
      const appId = String(params?.appId ?? "");
      if (!appId) {
        return { success: false, error: { code: "MISSING_PARAM", message: "appId is required" } };
      }

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        return { success: false, error: { code: "NOT_AUTHENTICATED", message: "User not logged in" } };
      }

      try {
        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
        const response = await fetch(`${supabaseUrl}/functions/v1/issue-app-token`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ app_id: appId }),
        });

        if (!response.ok) {
          const err = await response.json().catch(() => ({}));
          return { success: false, error: { code: "TOKEN_ERROR", message: err.error || "Failed to issue token" } };
        }

        const { token } = await response.json();
        return { success: true, data: { token } };
      } catch (err) {
        return { success: false, error: { code: "NETWORK_ERROR", message: err instanceof Error ? err.message : "Network error" } };
      }
    },
  },

  ui: {
    async showToast(params) {
      const message = String(params?.message ?? "");
      const type = String(params?.type ?? "info");

      switch (type) {
        case "success":
          toast.success(message);
          break;
        case "error":
          toast.error(message);
          break;
        case "warning":
          toast.warning(message);
          break;
        default:
          toast.info(message);
      }

      return { success: true };
    },

    async getTheme() {
      return {
        success: true,
        data: readThemeTokens(),
      };
    },
  },

  wallet: {
    async getBalance() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        return { success: false, error: { code: "NOT_AUTHENTICATED", message: "User not logged in" } };
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: wallet, error } = await (supabase as any)
        .from("wallets")
        .select("balance")
        .eq("user_id", user.id)
        .maybeSingle();

      if (error) {
        return { success: false, error: { code: "DB_ERROR", message: error.message } };
      }

      return { success: true, data: { balance: wallet?.balance ?? 0 } };
    },
  },
};

// ─── Context-aware handlers (need appDbId / channelId) ─

interface SDKContext {
  appDbId?: string;
  channelId?: string;
}

/** user.getInfo — returns app-scoped openid + platform profile */
async function userGetInfo(ctx: SDKContext): Promise<SDKResponse> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { success: false, error: { code: "NOT_AUTHENTICATED", message: "User not logged in" } };
  }

  // Get or create app-scoped openid
  let openid: string | null = null;
  if (ctx.appDbId) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any).rpc("get_or_create_openid", {
      p_user_id: user.id,
      p_app_id: ctx.appDbId,
    });
    if (error) {
      console.error("[SDKHost] get_or_create_openid error:", error);
    }
    openid = data as string | null;
  }

  // Fallback: if no appDbId or RPC failed, use a prefix + truncated user id
  if (!openid) {
    openid = `ou_${user.id.replace(/-/g, "").slice(0, 16)}`;
  }

  // Fetch platform profile
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: profile } = await (supabase as any)
    .from("profiles")
    .select("display_name, unique_username, avatar_url")
    .eq("id", user.id)
    .maybeSingle();

  return {
    success: true,
    data: {
      openid,
      nickname: profile?.display_name || profile?.unique_username || user.email || "用户",
      avatarUrl: profile?.avatar_url || null,
    },
  };
}

async function walletCharge(
  params: Record<string, unknown> | undefined,
  ctx: SDKContext
): Promise<SDKResponse> {
  const amount = Number(params?.amount ?? 0);
  const description = String(params?.description ?? "应用内消费");

  if (amount <= 0) {
    return { success: false, error: { code: "INVALID_AMOUNT", message: "Amount must be > 0" } };
  }

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { success: false, error: { code: "NOT_AUTHENTICATED", message: "User not logged in" } };
  }

  // ─── Payment eligibility check (reads policy from platform_settings) ───────
  if (ctx.appDbId) {
    // Fetch app info and payment policy in parallel
    const [appRes, settingsRes] = await Promise.all([
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (supabase as any)
        .from("apps")
        .select("payment_status, app_category")
        .eq("id", ctx.appDbId)
        .maybeSingle(),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (supabase as any)
        .from("platform_settings")
        .select("key, value")
        .eq("category", "payment")
        .in("key", ["restricted_categories", "charge_error_message"]),
    ]);

    const appData = appRes.data as { payment_status: string; app_category: string } | null;
    if (!appData) {
      return { success: false, error: { code: "APP_NOT_FOUND", message: "应用不存在或无法访问" } };
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const settingsMap = Object.fromEntries(((settingsRes.data ?? []) as any[]).map((s) => [s.key, s.value]));

    const restrictedCategories: string[] = Array.isArray(settingsMap["restricted_categories"])
      ? (settingsMap["restricted_categories"] as string[])
      : ["gambling", "finance"]; // safe fallback

    const chargeErrorMsg: string =
      typeof settingsMap["charge_error_message"] === "string"
        ? (settingsMap["charge_error_message"] as string)
        : "此应用未开通平台支付";

    const isPaymentEnabled = appData.payment_status === "enabled";
    const isCategoryRestricted = restrictedCategories.includes(appData.app_category);

    if (!isPaymentEnabled || isCategoryRestricted) {
      return { success: false, error: { code: "PAYMENT_RESTRICTED", message: chargeErrorMsg } };
    }
  }
  // ─────────────────────────────────────────────────────────────────────────────

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: wallet, error: walletError } = await (supabase as any)
    .from("wallets")
    .select("id, balance, total_spent")
    .eq("user_id", user.id)
    .maybeSingle();

  if (walletError || !wallet) {
    return { success: false, error: { code: "WALLET_NOT_FOUND", message: "Wallet not found" } };
  }

  if (wallet.balance < amount) {
    return { success: false, error: { code: "INSUFFICIENT_BALANCE", message: "余额不足" } };
  }

  const newBalance = wallet.balance - amount;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: updateError } = await (supabase as any)
    .from("wallets")
    .update({ balance: newBalance, total_spent: wallet.total_spent + amount })
    .eq("id", wallet.id);

  if (updateError) {
    return { success: false, error: { code: "UPDATE_ERROR", message: updateError.message } };
  }

  // Record in user's wallet transaction history
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase as any).from("transactions").insert({
    wallet_id: wallet.id,
    type: "app_charge",
    amount: -amount,
    balance_after: newBalance,
    description,
  });

  // Insert app_transaction — triggers 5-way revenue split in DB
  if (ctx.appDbId) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any).from("app_transactions").insert({
      app_id: ctx.appDbId,
      user_id: user.id,
      channel_id: ctx.channelId ?? null,
      amount,
      description,
    });
  }

  return { success: true, data: { success: true, newBalance } };
}

// ─── Global Request Router ─────────────────────────────

async function globalHandleSDKRequest(
  module: string,
  method: string,
  params?: Record<string, unknown>
): Promise<SDKResponse> {
  const moduleHandlers = handlers[module];
  if (!moduleHandlers) {
    return {
      success: false,
      error: { code: "UNKNOWN_MODULE", message: `Unknown module: ${module}` },
    };
  }

  const handler = moduleHandlers[method];
  if (!handler) {
    return {
      success: false,
      error: { code: "UNKNOWN_METHOD", message: `Unknown method: ${module}.${method}` },
    };
  }

  try {
    return await handler(params);
  } catch (err) {
    return {
      success: false,
      error: {
        code: "HANDLER_ERROR",
        message: err instanceof Error ? err.message : String(err),
      },
    };
  }
}

// ─── Public API ────────────────────────────────────────

export interface SDKHostConnection {
  /** Send an event to the app */
  sendEvent: (event: SDKEvent) => void;
  /** Disconnect and clean up */
  destroy: () => void;
}

/**
 * Connect to an app running in the given iframe element.
 * Must be called after the iframe's contentWindow is available.
 * Returns a handle to send events and destroy the connection.
 */
export function createSDKHost(
  appId: string,
  iframe: HTMLIFrameElement,
  context?: SDKContext
): SDKHostConnection {
  type RemoteProxy = { handleEvent: (event: SDKEvent) => Promise<void> };
  let childMethods: RemoteProxy | null = null;

  const contentWindow = iframe.contentWindow;
  if (!contentWindow) {
    console.error(`[SDKHost] iframe.contentWindow is null for app: ${appId}`);
    return {
      sendEvent() {},
      destroy() {},
    };
  }

  const ctx = context ?? {};

  // Per-connection handler: routes context-aware calls (user.getInfo, wallet.charge)
  async function handleSDKRequest(
    module: string,
    method: string,
    params?: Record<string, unknown>
  ): Promise<SDKResponse> {
    if (module === "user" && method === "getInfo") {
      return userGetInfo(ctx);
    }
    if (module === "wallet" && method === "charge") {
      return walletCharge(params, ctx);
    }
    return globalHandleSDKRequest(module, method, params);
  }

  const messenger = new WindowMessenger({
    remoteWindow: contentWindow,
    allowedOrigins: ["*"],
  });

  const penpalConnection: Connection<AppMethods> = connect<AppMethods>({
    messenger,
    methods: {
      handleSDKRequest,
    },
  });

  penpalConnection.promise
    .then((child) => {
      childMethods = child as unknown as RemoteProxy;
      console.log(`[SDKHost] Connected to app: ${appId}`);
    })
    .catch((err) => {
      console.error(`[SDKHost] Failed to connect to app ${appId}:`, err);
    });

  return {
    sendEvent(event: SDKEvent) {
      if (childMethods) {
        childMethods.handleEvent(event);
      }
    },
    destroy() {
      penpalConnection.destroy();
      childMethods = null;
      console.log(`[SDKHost] Disconnected from app: ${appId}`);
    },
  };
}
