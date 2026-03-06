import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb = supabase as any;

const QUERY_KEY = "platform-settings";

/** Read all platform_settings as a Record<key, value> */
export function usePlatformSettings() {
  return useQuery<Record<string, string>>({
    queryKey: [QUERY_KEY],
    queryFn: async () => {
      const { data, error } = await sb
        .from("platform_settings")
        .select("key, value");
      if (error) throw error;
      const map: Record<string, string> = {};
      for (const row of data || []) {
        map[row.key] = row.value;
      }
      return map;
    },
    staleTime: 30_000,
  });
}

/** Update a single platform_settings key */
export function useUpdatePlatformSetting() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ key, value }: { key: string; value: string }) => {
      const { error } = await sb
        .from("platform_settings")
        .update({ value, updated_at: new Date().toISOString() })
        .eq("key", key);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [QUERY_KEY] });
    },
  });
}
