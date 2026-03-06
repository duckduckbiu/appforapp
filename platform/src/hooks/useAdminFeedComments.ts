import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface FeedComment {
  id: string;
  feed_id: string;
  user_id: string;
  content: string;
  parent_id: string | null;
  is_deleted: boolean;
  created_at: string;
  updated_at: string;
  // joined
  article_title?: string;
  author_name?: string;
}

export interface LikeAggregation {
  feed_id: string;
  title: string;
  like_count: number;
  source: string;
}

export interface BookmarkAggregation {
  feed_id: string;
  title: string;
  bookmark_count: number;
  source: string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb = supabase as any;

const PAGE_SIZE = 20;

export function useAdminFeedComments(search: string, page: number) {
  return useQuery({
    queryKey: ["admin-feed-comments", search, page],
    queryFn: async () => {
      let query = sb
        .from("feed_item_comments")
        .select("*", { count: "exact" })
        .eq("is_deleted", false)
        .order("created_at", { ascending: false });

      if (search) {
        query = query.ilike("content", `%${search}%`);
      }

      const from = page * PAGE_SIZE;
      query = query.range(from, from + PAGE_SIZE - 1);

      const { data, error, count } = await query;
      if (error) throw error;

      // Fetch article titles
      const feedIds = [...new Set((data || []).map((c: FeedComment) => c.feed_id))];
      let articleMap: Record<string, string> = {};
      if (feedIds.length > 0) {
        const { data: articles } = await sb
          .from("aggregated_feed")
          .select("id, title")
          .in("id", feedIds);
        if (articles) {
          articleMap = Object.fromEntries(articles.map((a: { id: string; title: string }) => [a.id, a.title]));
        }
      }

      // Fetch user names
      const userIds = [...new Set((data || []).map((c: FeedComment) => c.user_id))];
      let userMap: Record<string, string> = {};
      if (userIds.length > 0) {
        const { data: profiles } = await sb
          .from("profiles")
          .select("id, username, full_name")
          .in("id", userIds);
        if (profiles) {
          userMap = Object.fromEntries(
            profiles.map((p: { id: string; username: string; full_name: string | null }) => [
              p.id,
              p.full_name || p.username || "匿名",
            ])
          );
        }
      }

      return {
        items: (data || []).map((c: FeedComment) => ({
          ...c,
          article_title: articleMap[c.feed_id] || "未知文章",
          author_name: userMap[c.user_id] || "匿名",
        })) as FeedComment[],
        totalCount: count || 0,
        totalPages: Math.ceil((count || 0) / PAGE_SIZE),
      };
    },
    staleTime: 60 * 1000,
  });
}

export function useDeleteComment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (commentId: string) => {
      const { error } = await sb
        .from("feed_item_comments")
        .update({ is_deleted: true })
        .eq("id", commentId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-feed-comments"] });
    },
  });
}

export function useTopLikedArticles() {
  return useQuery({
    queryKey: ["admin-feed-top-liked"],
    queryFn: async () => {
      const { data, error } = await sb
        .from("aggregated_feed")
        .select("id, title, source, like_count")
        .gt("like_count", 0)
        .order("like_count", { ascending: false })
        .limit(20);
      if (error) throw error;
      return (data || []) as LikeAggregation[];
    },
    staleTime: 5 * 60 * 1000,
  });
}

export function useTopBookmarkedArticles() {
  return useQuery({
    queryKey: ["admin-feed-top-bookmarked"],
    queryFn: async () => {
      const { data, error } = await sb
        .from("aggregated_feed")
        .select("id, title, source, bookmark_count")
        .gt("bookmark_count", 0)
        .order("bookmark_count", { ascending: false })
        .limit(20);
      if (error) throw error;
      return (data || []) as BookmarkAggregation[];
    },
    staleTime: 5 * 60 * 1000,
  });
}
