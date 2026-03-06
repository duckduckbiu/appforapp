import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useIdentity } from "@/contexts/IdentityContext";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb = supabase as any;

/**
 * Batch-fetch user's likes & bookmarks for a set of feed item IDs.
 * Returns sets for O(1) lookup.
 */
export function useFeedItemStatus(feedIds: string[]) {
  const { currentIdentity } = useIdentity();
  const userId = currentIdentity?.profile?.id;

  return useQuery({
    queryKey: ["feed-item-status", userId, feedIds.sort().join(",")],
    queryFn: async () => {
      if (!userId || feedIds.length === 0) {
        return { likedIds: new Set<string>(), bookmarkedIds: new Set<string>() };
      }

      const [likesRes, bookmarksRes] = await Promise.all([
        sb.from("feed_item_likes").select("feed_id").eq("user_id", userId).in("feed_id", feedIds),
        sb.from("feed_item_bookmarks").select("feed_id").eq("user_id", userId).in("feed_id", feedIds),
      ]);

      return {
        likedIds: new Set<string>((likesRes.data || []).map((r: { feed_id: string }) => r.feed_id)),
        bookmarkedIds: new Set<string>((bookmarksRes.data || []).map((r: { feed_id: string }) => r.feed_id)),
      };
    },
    enabled: !!userId && feedIds.length > 0,
    staleTime: 2 * 60 * 1000,
  });
}

/**
 * Toggle like on a feed item
 */
export function useFeedLike() {
  const { currentIdentity } = useIdentity();
  const userId = currentIdentity?.profile?.id;
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ feedId, isLiked }: { feedId: string; isLiked: boolean }) => {
      if (!userId) throw new Error("Not authenticated");

      if (isLiked) {
        const { error } = await sb
          .from("feed_item_likes")
          .delete()
          .eq("feed_id", feedId)
          .eq("user_id", userId);
        if (error) throw error;
      } else {
        const { error } = await sb
          .from("feed_item_likes")
          .insert({ feed_id: feedId, user_id: userId });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["feed-item-status"] });
      queryClient.invalidateQueries({ queryKey: ["aggregated-feed"] });
    },
  });
}

/**
 * Toggle bookmark on a feed item
 */
export function useFeedBookmark() {
  const { currentIdentity } = useIdentity();
  const userId = currentIdentity?.profile?.id;
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ feedId, isBookmarked }: { feedId: string; isBookmarked: boolean }) => {
      if (!userId) throw new Error("Not authenticated");

      if (isBookmarked) {
        const { error } = await sb
          .from("feed_item_bookmarks")
          .delete()
          .eq("feed_id", feedId)
          .eq("user_id", userId);
        if (error) throw error;
      } else {
        const { error } = await sb
          .from("feed_item_bookmarks")
          .insert({ feed_id: feedId, user_id: userId });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["feed-item-status"] });
      queryClient.invalidateQueries({ queryKey: ["aggregated-feed"] });
    },
  });
}
