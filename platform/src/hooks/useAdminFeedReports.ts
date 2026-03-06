import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface FeedReport {
  id: string;
  feed_id: string;
  user_id: string;
  reason: string;
  details: string | null;
  status: string;
  created_at: string;
  resolved_at: string | null;
  resolved_by: string | null;
  resolution_note: string | null;
  // Joined
  article_title?: string;
  article_url?: string;
  article_source?: string;
  reporter_name?: string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb = supabase as any;

export function useAdminFeedReports(statusFilter: string) {
  return useQuery({
    queryKey: ["admin-feed-reports", statusFilter],
    queryFn: async () => {
      let query = sb
        .from("feed_item_reports")
        .select("*")
        .order("created_at", { ascending: false });

      if (statusFilter === "pending") {
        query = query.eq("status", "pending");
      } else if (statusFilter === "resolved") {
        query = query.neq("status", "pending");
      }

      const { data, error } = await query;
      if (error) throw error;

      // Fetch article titles for the reports
      const feedIds = [...new Set((data || []).map((r: FeedReport) => r.feed_id))];
      let articleMap: Record<string, { title: string; url: string; source: string }> = {};
      if (feedIds.length > 0) {
        const { data: articles } = await sb
          .from("aggregated_feed")
          .select("id, title, url, source")
          .in("id", feedIds);
        if (articles) {
          articleMap = Object.fromEntries(
            articles.map((a: { id: string; title: string; url: string; source: string }) => [
              a.id,
              { title: a.title, url: a.url, source: a.source },
            ])
          );
        }
      }

      return (data || []).map((r: FeedReport) => ({
        ...r,
        article_title: articleMap[r.feed_id]?.title || "未知文章",
        article_url: articleMap[r.feed_id]?.url,
        article_source: articleMap[r.feed_id]?.source,
      })) as FeedReport[];
    },
    staleTime: 60 * 1000,
  });
}

export function useReportStats() {
  return useQuery({
    queryKey: ["admin-feed-report-stats"],
    queryFn: async () => {
      const [pendingRes, todayRes, totalRes] = await Promise.all([
        sb.from("feed_item_reports").select("id", { count: "exact", head: true }).eq("status", "pending"),
        sb.from("feed_item_reports").select("id", { count: "exact", head: true }).gte("resolved_at", new Date(new Date().setHours(0, 0, 0, 0)).toISOString()),
        sb.from("feed_item_reports").select("id", { count: "exact", head: true }),
      ]);
      return {
        pending: pendingRes.count || 0,
        resolvedToday: todayRes.count || 0,
        total: totalRes.count || 0,
      };
    },
    staleTime: 60 * 1000,
  });
}

interface ResolveParams {
  reportId: string;
  resolution: "resolved_approved" | "resolved_rejected" | "resolved_hidden";
  note?: string;
  feedId: string;
}

export function useResolveReport() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ reportId, resolution, note, feedId }: ResolveParams) => {
      const { data: { user } } = await supabase.auth.getUser();

      const { error } = await sb
        .from("feed_item_reports")
        .update({
          status: resolution,
          resolved_at: new Date().toISOString(),
          resolved_by: user?.id,
          resolution_note: note || null,
        })
        .eq("id", reportId);
      if (error) throw error;

      // If hiding the article, update its status
      if (resolution === "resolved_hidden") {
        const { error: feedError } = await sb
          .from("aggregated_feed")
          .update({ status: "hidden" })
          .eq("id", feedId);
        if (feedError) throw feedError;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-feed-reports"] });
      qc.invalidateQueries({ queryKey: ["admin-feed-report-stats"] });
    },
  });
}
