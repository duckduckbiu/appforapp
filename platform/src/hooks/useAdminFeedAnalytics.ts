import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb = supabase as any;

export function useFeedDashboardStats() {
  return useQuery({
    queryKey: ["admin-feed-dashboard-stats"],
    queryFn: async () => {
      const [articlesRes, sourcesRes, interactionsRes, reportsRes] = await Promise.all([
        sb.from("aggregated_feed").select("id", { count: "exact", head: true }),
        sb.from("feed_sources").select("id", { count: "exact", head: true }).eq("is_active", true),
        sb.from("aggregated_feed").select("like_count, bookmark_count, comment_count"),
        sb.from("feed_item_reports").select("id", { count: "exact", head: true }).eq("status", "pending"),
      ]);

      const interactions = (interactionsRes.data || []).reduce(
        (acc: number, item: { like_count: number; bookmark_count: number; comment_count: number }) =>
          acc + (item.like_count || 0) + (item.bookmark_count || 0) + (item.comment_count || 0),
        0
      );

      return {
        totalArticles: articlesRes.count || 0,
        activeSources: sourcesRes.count || 0,
        totalInteractions: interactions,
        pendingReports: reportsRes.count || 0,
      };
    },
    staleTime: 2 * 60 * 1000,
  });
}

export interface DayCount {
  date: string;
  count: number;
}

export function useFeedArticleTrend() {
  return useQuery({
    queryKey: ["admin-feed-article-trend"],
    queryFn: async () => {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const { data, error } = await sb
        .from("aggregated_feed")
        .select("published_at")
        .gte("published_at", thirtyDaysAgo.toISOString())
        .order("published_at");

      if (error) throw error;

      // Group by day
      const dayMap: Record<string, number> = {};
      for (let i = 0; i < 30; i++) {
        const d = new Date();
        d.setDate(d.getDate() - 29 + i);
        dayMap[d.toISOString().slice(0, 10)] = 0;
      }

      (data || []).forEach((item: { published_at: string }) => {
        if (item.published_at) {
          const day = item.published_at.slice(0, 10);
          if (dayMap[day] !== undefined) dayMap[day]++;
        }
      });

      return Object.entries(dayMap).map(([date, count]) => ({
        date,
        count,
      })) as DayCount[];
    },
    staleTime: 5 * 60 * 1000,
  });
}

export interface CategoryCount {
  category: string;
  count: number;
}

export function useFeedCategoryDistribution() {
  return useQuery({
    queryKey: ["admin-feed-category-dist"],
    queryFn: async () => {
      const { data, error } = await sb
        .from("aggregated_feed")
        .select("tags");
      if (error) throw error;

      const catMap: Record<string, number> = {};
      (data || []).forEach((item: { tags: string[] | null }) => {
        const tag = item.tags?.[0] || "uncategorized";
        catMap[tag] = (catMap[tag] || 0) + 1;
      });

      return Object.entries(catMap)
        .map(([category, count]) => ({ category, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 15) as CategoryCount[];
    },
    staleTime: 5 * 60 * 1000,
  });
}

export interface SourceCount {
  source: string;
  count: number;
}

export function useFeedSourceDistribution() {
  return useQuery({
    queryKey: ["admin-feed-source-dist"],
    queryFn: async () => {
      const { data, error } = await sb
        .from("aggregated_feed")
        .select("source");
      if (error) throw error;

      const srcMap: Record<string, number> = {};
      (data || []).forEach((item: { source: string }) => {
        srcMap[item.source] = (srcMap[item.source] || 0) + 1;
      });

      return Object.entries(srcMap)
        .map(([source, count]) => ({ source, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 15) as SourceCount[];
    },
    staleTime: 5 * 60 * 1000,
  });
}

export interface TopArticle {
  id: string;
  title: string;
  source: string;
  like_count: number;
  bookmark_count: number;
  comment_count: number;
  total: number;
}

export function useFeedTopArticles() {
  return useQuery({
    queryKey: ["admin-feed-top-articles"],
    queryFn: async () => {
      const { data, error } = await sb
        .from("aggregated_feed")
        .select("id, title, source, like_count, bookmark_count, comment_count")
        .order("like_count", { ascending: false })
        .limit(10);
      if (error) throw error;

      return (data || []).map((a: TopArticle) => ({
        ...a,
        total: (a.like_count || 0) + (a.bookmark_count || 0) + (a.comment_count || 0),
      })) as TopArticle[];
    },
    staleTime: 5 * 60 * 1000,
  });
}
