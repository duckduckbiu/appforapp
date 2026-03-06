import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface FeedCategory {
  id: string;
  label_zh: string;
  label_en: string;
  icon: string | null;
  color_class: string | null;
  sort_order: number;
  is_active: boolean;
}

export function useFeedCategories() {
  return useQuery({
    queryKey: ["feed-categories"],
    queryFn: async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any)
        .from("feed_categories")
        .select("*")
        .eq("is_active", true)
        .order("sort_order");
      if (error) {
        console.warn("[FeedCategories] query failed:", error.message);
        return [] as FeedCategory[];
      }
      return (data || []) as FeedCategory[];
    },
    staleTime: 30 * 60 * 1000, // 30 min — categories rarely change
  });
}

/** Map color_class (e.g. "red") to Tailwind bg/text classes */
export function getCategoryColorClasses(colorClass: string | null): string {
  const map: Record<string, string> = {
    red: "bg-red-500/10 text-red-600 dark:text-red-400",
    blue: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
    violet: "bg-violet-500/10 text-violet-600 dark:text-violet-400",
    purple: "bg-purple-500/10 text-purple-600 dark:text-purple-400",
    green: "bg-green-500/10 text-green-600 dark:text-green-400",
    amber: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
    slate: "bg-slate-500/10 text-slate-600 dark:text-slate-400",
    orange: "bg-orange-500/10 text-orange-600 dark:text-orange-400",
    pink: "bg-pink-500/10 text-pink-600 dark:text-pink-400",
    rose: "bg-rose-500/10 text-rose-600 dark:text-rose-400",
    cyan: "bg-cyan-500/10 text-cyan-600 dark:text-cyan-400",
    emerald: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
    indigo: "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400",
    yellow: "bg-yellow-500/10 text-yellow-600 dark:text-yellow-400",
    gray: "bg-muted text-muted-foreground",
  };
  return map[colorClass || "gray"] || map.gray;
}
