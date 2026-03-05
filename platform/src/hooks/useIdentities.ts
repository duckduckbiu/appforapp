import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Tables } from "@/integrations/supabase/types";

type Profile = Tables<"profiles">;

export interface Identity {
  type: "human";
  profile: Profile;
}

/**
 * React Query hook for fetching the current user's identity (profile).
 */
export function useIdentities(userId: string | undefined) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["identities", userId],
    queryFn: async () => {
      if (!userId) return [];
      return await loadIdentity(userId);
    },
    enabled: !!userId,
    staleTime: 1000 * 60 * 5,
    gcTime: 1000 * 60 * 30,
  });

  // Realtime: invalidate when user's profile changes
  useEffect(() => {
    if (!userId) return;

    const channel = supabase
      .channel(`identity-profile-${userId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "profiles",
          filter: `id=eq.${userId}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ["identities", userId] });
        }
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
      supabase.removeChannel(channel);
    };
  }, [userId, queryClient]);

  return query;
}

async function loadIdentity(userId: string): Promise<Identity[]> {
  try {
    const { data: profile, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .single();

    if (error || !profile) {
      console.error("Failed to load user profile:", error);
      return [];
    }

    return [{ type: "human", profile }];
  } catch (error) {
    console.error("Failed to load user identity:", error);
    return [];
  }
}
