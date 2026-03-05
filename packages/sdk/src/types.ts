/**
 * @billai/app-sdk — Core type definitions
 *
 * These types define the communication protocol between
 * apps (running in iframe) and the Bill.ai platform.
 */

// ─── Request / Response ────────────────────────────────

/** App → Platform RPC call */
export interface SDKRequest {
  module: string;
  method: string;
  params?: Record<string, unknown>;
}

/** Platform → App RPC response */
export interface SDKResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
  };
}

// ─── Events ────────────────────────────────────────────

/** Platform → App push event */
export interface SDKEvent {
  type: string;
  payload: unknown;
}

export type EventCallback = (event: SDKEvent) => void;

// ─── User ──────────────────────────────────────────────

export interface UserInfo {
  /** App-scoped unique identifier (e.g. "ou_a1b2c3d4..."). Different per app. */
  openid: string;
  /** Platform display name */
  nickname: string;
  /** Platform avatar URL */
  avatarUrl: string | null;
}

// ─── UI / Theme ────────────────────────────────────────

export interface ThemeTokens {
  primary: string;
  primaryForeground: string;
  background: string;
  foreground: string;
  muted: string;
  mutedForeground: string;
  accent: string;
  accentForeground: string;
  border: string;
  radius: string;
}

export type ToastType = "success" | "error" | "info" | "warning";

// ─── App Manifest ──────────────────────────────────────

export interface AppManifest {
  appId: string;
  name: string;
  version: string;
  description?: string;
  icon?: string;
  permissions: string[];
  entryUrl: string;
}

// ─── Penpal Method Map ─────────────────────────────────

/**
 * Methods the platform exposes to the app (child → parent calls).
 * Penpal uses this interface for type-safe RPC.
 */
export interface PlatformMethods {
  handleSDKRequest: (
    module: string,
    method: string,
    params?: Record<string, unknown>
  ) => Promise<SDKResponse>;
}

/**
 * Methods the app exposes to the platform (parent → child calls).
 * Used for platform-initiated events (theme change, etc.).
 */
export interface AppMethods {
  handleEvent: (event: SDKEvent) => void;
}
