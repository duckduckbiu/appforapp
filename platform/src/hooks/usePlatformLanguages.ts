import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb = supabase as any;

export interface PlatformLanguage {
  code: string;
  label_native: string;
  label_en: string;
  flag: string;
  is_enabled: boolean;
  sort_order: number;
}

const QUERY_KEY = "platform-languages";

/** All languages (admin use) */
export function usePlatformLanguages() {
  return useQuery<PlatformLanguage[]>({
    queryKey: [QUERY_KEY],
    queryFn: async () => {
      const { data, error } = await sb
        .from("platform_languages")
        .select("code, label_native, label_en, flag, is_enabled, sort_order")
        .order("sort_order");
      if (error) throw error;
      return data || [];
    },
    staleTime: 5 * 60 * 1000,
  });
}

/** Only enabled languages (user-facing) */
export function useEnabledLanguages() {
  return useQuery<PlatformLanguage[]>({
    queryKey: [QUERY_KEY, "enabled"],
    queryFn: async () => {
      const { data, error } = await sb
        .from("platform_languages")
        .select("code, label_native, label_en, flag, is_enabled, sort_order")
        .eq("is_enabled", true)
        .order("sort_order");
      if (error) throw error;
      return data || [];
    },
    staleTime: 5 * 60 * 1000,
  });
}

/** Toggle language enabled/disabled */
export function useToggleLanguage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ code, enabled }: { code: string; enabled: boolean }) => {
      const { error } = await sb
        .from("platform_languages")
        .update({ is_enabled: enabled })
        .eq("code", code);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [QUERY_KEY] });
    },
  });
}

/** Update sort order for a language */
export function useUpdateLanguageOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ code, sort_order }: { code: string; sort_order: number }) => {
      const { error } = await sb
        .from("platform_languages")
        .update({ sort_order })
        .eq("code", code);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [QUERY_KEY] });
    },
  });
}

/** Add a new language */
export function useAddLanguage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (lang: Omit<PlatformLanguage, "is_enabled" | "sort_order"> & { sort_order?: number }) => {
      const { error } = await sb
        .from("platform_languages")
        .insert({
          code: lang.code,
          label_native: lang.label_native,
          label_en: lang.label_en,
          flag: lang.flag,
          is_enabled: false,
          sort_order: lang.sort_order ?? 99,
        });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [QUERY_KEY] });
    },
  });
}

/** Delete a language */
export function useDeleteLanguage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (code: string) => {
      const { error } = await sb
        .from("platform_languages")
        .delete()
        .eq("code", code);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [QUERY_KEY] });
    },
  });
}
