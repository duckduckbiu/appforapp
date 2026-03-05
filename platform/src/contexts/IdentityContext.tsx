import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { supabase, isSupabaseConfigured } from "@/integrations/supabase/client";
import { useIdentities, type Identity } from "@/hooks/useIdentities";

export interface BanInfo {
  reason: string | null;
  expires_at: string | null;
}

interface IdentityContextType {
  currentIdentity: Identity | null;
  availableIdentities: Identity[];
  switchIdentity: (identity: Identity) => void;
  refreshIdentities: () => void;
  isLoading: boolean;
  isAuthChecking: boolean;
  banInfo: BanInfo | null;
}

const IdentityContext = createContext<IdentityContextType | undefined>(undefined);

export function IdentityProvider({ children }: { children: ReactNode }) {
  const [currentIdentity, setCurrentIdentity] = useState<Identity | null>(null);
  const [userId, setUserId] = useState<string | undefined>(undefined);
  const [isAuthChecking, setIsAuthChecking] = useState(true);
  const [banInfo, setBanInfo] = useState<BanInfo | null>(null);

  const { data: availableIdentities = [], isLoading: isIdentitiesLoading, refetch } = useIdentities(userId);

  // Listen for auth state changes
  useEffect(() => {
    if (!isSupabaseConfigured) {
      // No backend — skip auth, render shell in offline mode
      setIsAuthChecking(false);
      return;
    }

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUserId(session?.user?.id);
      setIsAuthChecking(false);
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      setUserId(session?.user?.id);
      setIsAuthChecking(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Check for active bans when userId resolves
  useEffect(() => {
    if (!userId || !isSupabaseConfigured) {
      setBanInfo(null);
      return;
    }

    const checkBan = async () => {
      const now = new Date().toISOString();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data } = await (supabase as any)
        .from("bans")
        .select("reason, expires_at")
        .eq("user_id", userId)
        .or(`expires_at.is.null,expires_at.gt.${now}`)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      setBanInfo(data ? { reason: data.reason, expires_at: data.expires_at } : null);
    };

    checkBan();
  }, [userId]);

  // Write referral attribution on first login (reads localStorage billai_referral)
  useEffect(() => {
    if (!userId || !isSupabaseConfigured) return;

    const raw = localStorage.getItem("billai_referral");
    if (!raw) return;

    let referral: { code: string; ts: number };
    try {
      referral = JSON.parse(raw);
    } catch {
      localStorage.removeItem("billai_referral");
      return;
    }

    // Check 30-day expiry
    if (Date.now() - referral.ts > 30 * 24 * 60 * 60 * 1000) {
      localStorage.removeItem("billai_referral");
      return;
    }

    const writeAttribution = async () => {
      // Look up the promoter link by code
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: link } = await (supabase as any)
        .from("promoter_links")
        .select("id, user_id, register_count")
        .eq("code", referral.code)
        .maybeSingle();

      if (!link) {
        localStorage.removeItem("billai_referral");
        return;
      }

      // Prevent self-referral
      if (link.user_id === userId) {
        localStorage.removeItem("billai_referral");
        return;
      }

      // Insert attribution (ignore conflict — user may already have one)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any)
        .from("referral_attributions")
        .insert({ user_id: userId, referrer_id: link.user_id, link_id: link.id });

      // Increment register count on the promoter link
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any)
        .from("promoter_links")
        .update({ register_count: link.register_count + 1 })
        .eq("id", link.id);

      localStorage.removeItem("billai_referral");
    };

    writeAttribution();
  }, [userId]);

  // Set current identity when profile loads
  useEffect(() => {
    if (isIdentitiesLoading || availableIdentities.length === 0) return;
    setCurrentIdentity(availableIdentities[0]);
  }, [availableIdentities, isIdentitiesLoading]);

  // Keep interface compatible — switchIdentity is a no-op now (single identity)
  const switchIdentity = (identity: Identity) => {
    setCurrentIdentity(identity);
  };

  const refreshIdentities = () => {
    refetch();
  };

  const isLoading = isAuthChecking || (userId !== undefined && isIdentitiesLoading);

  return (
    <IdentityContext.Provider
      value={{
        currentIdentity,
        availableIdentities,
        switchIdentity,
        refreshIdentities,
        isLoading,
        isAuthChecking,
        banInfo,
      }}
    >
      {children}
    </IdentityContext.Provider>
  );
}

export function useIdentity() {
  const context = useContext(IdentityContext);
  if (context === undefined) {
    throw new Error("useIdentity must be used within an IdentityProvider");
  }
  return context;
}
