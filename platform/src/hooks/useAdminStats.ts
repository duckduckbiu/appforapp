import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb = supabase as any;

export interface PlatformStats {
  userCount: number;
  postCount: number;
  feedItemCount: number;
  feedSourceCount: number;
  feedSourceErrors: number;
  activeBans: number;
}

/**
 * Fetch platform-wide stats for the admin dashboard overview
 */
export function useAdminStats() {
  return useQuery({
    queryKey: ["admin-stats"],
    queryFn: async (): Promise<PlatformStats> => {
      const [users, posts, feedItems, sources, bans] = await Promise.all([
        supabase.from("profiles").select("*", { count: "exact", head: true }),
        supabase.from("posts").select("*", { count: "exact", head: true }),
        sb.from("aggregated_feed").select("*", { count: "exact", head: true }),
        sb.from("feed_sources").select("id, is_active, error_count"),
        supabase.from("bans").select("*", { count: "exact", head: true }),
      ]);

      // Compute feed source stats
      const sourceData = sources.data || [];
      const feedSourceCount = sourceData.length;
      const feedSourceErrors = sourceData.filter(
        (s: { error_count: number }) => s.error_count > 0,
      ).length;

      return {
        userCount: users.count || 0,
        postCount: posts.count || 0,
        feedItemCount: feedItems.count || 0,
        feedSourceCount,
        feedSourceErrors,
        activeBans: bans.count || 0,
      };
    },
    staleTime: 60_000,
  });
}

interface DayCount {
  date: string;
  count: number;
}

/**
 * Fetch user registration trend for the last 30 days
 */
export function useUserGrowth() {
  return useQuery({
    queryKey: ["admin-user-growth"],
    queryFn: async (): Promise<DayCount[]> => {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const { data } = await supabase
        .from("profiles")
        .select("created_at")
        .gte("created_at", thirtyDaysAgo.toISOString())
        .order("created_at");

      if (!data) return [];

      // Group by date
      const counts: Record<string, number> = {};
      for (const row of data) {
        const day = row.created_at.slice(0, 10); // YYYY-MM-DD
        counts[day] = (counts[day] || 0) + 1;
      }

      // Fill missing days
      const result: DayCount[] = [];
      const cursor = new Date(thirtyDaysAgo);
      cursor.setHours(0, 0, 0, 0);
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      while (cursor <= today) {
        const key = cursor.toISOString().slice(0, 10);
        result.push({ date: key, count: counts[key] || 0 });
        cursor.setDate(cursor.getDate() + 1);
      }

      return result;
    },
    staleTime: 5 * 60_000,
  });
}

/**
 * Fetch recent feed source health for the overview panel
 */
export function useFeedSourceHealth() {
  return useQuery({
    queryKey: ["admin-feed-source-health"],
    queryFn: async () => {
      const { data } = await sb
        .from("feed_sources")
        .select("id, name, is_active, error_count, last_error, last_fetched_at, item_count")
        .order("error_count", { ascending: false })
        .limit(10);

      return (data || []) as Array<{
        id: string;
        name: string;
        is_active: boolean;
        error_count: number;
        last_error: string | null;
        last_fetched_at: string | null;
        item_count: number;
      }>;
    },
    staleTime: 60_000,
  });
}
