import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface Hashtag {
  id: string;
  name: string;
  post_count: number;
  created_at: string;
}

// Extract hashtags from content
export function extractHashtags(content: string): string[] {
  const regex = /#([\u4e00-\u9fa5\w]+)/g;
  const matches = content.match(regex);
  if (!matches) return [];
  return [...new Set(matches.map((tag) => tag.slice(1).toLowerCase()))];
}

// Search hashtags
export function useHashtagSearch(query: string) {
  return useQuery({
    queryKey: ["hashtag-search", query],
    queryFn: async () => {
      if (!query.trim()) return [];

      const { data, error } = await supabase
        .from("hashtags")
        .select("*")
        .ilike("name", `%${query}%`)
        .order("post_count", { ascending: false })
        .limit(10);

      if (error) throw error;
      return data as Hashtag[];
    },
    enabled: query.trim().length >= 1,
    staleTime: 30000,
  });
}

// Get trending hashtags
export function useTrendingHashtags(limit = 10) {
  return useQuery({
    queryKey: ["trending-hashtags", limit],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("hashtags")
        .select("*")
        .order("post_count", { ascending: false })
        .limit(limit);

      if (error) throw error;
      return data as Hashtag[];
    },
    staleTime: 60000,
  });
}

// Get posts by hashtag
export function useHashtagPosts(hashtagName: string) {
  return useQuery({
    queryKey: ["hashtag-posts", hashtagName],
    queryFn: async () => {
      if (!hashtagName) return { hashtag: null, posts: [] };

      // Get hashtag info
      const { data: hashtag, error: hashtagError } = await supabase
        .from("hashtags")
        .select("*")
        .eq("name", hashtagName.toLowerCase())
        .single();

      if (hashtagError || !hashtag) {
        return { hashtag: null, posts: [] };
      }

      // Get posts with this hashtag
      const { data: postHashtags, error: postsError } = await supabase
        .from("post_hashtags")
        .select(`
          post_id,
          posts!inner (
            id,
            content,
            created_at,
            author_id,
            likes_count,
            comments_count,
            shares_count,
            visibility,
            is_deleted,
            author:profiles!posts_author_id_fkey (
              id,
              display_name,
              unique_username,
              avatar_url
            ),
            media:post_media (
              id,
              media_url,
              media_type,
              thumbnail_url,
              mask_regions,
              original_media_url
            )
          )
        `)
        .eq("hashtag_id", hashtag.id)
        .order("created_at", { ascending: false })
        .limit(50);

      if (postsError) throw postsError;

      const posts = (postHashtags || [])
        .map((ph: any) => ph.posts)
        .filter((p: any) => p && !p.is_deleted && p.visibility === "public");

      return { hashtag, posts };
    },
    enabled: !!hashtagName,
    staleTime: 30000,
  });
}

// Link hashtags to post
export function useLinkHashtags() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ postId, hashtags }: { postId: string; hashtags: string[] }) => {
      if (hashtags.length === 0) return;

      // Get or create hashtags and link them
      for (const tag of hashtags) {
        // Use database function to get or create hashtag
        const { data: hashtagId, error: hashtagError } = await supabase.rpc(
          "get_or_create_hashtag",
          { tag_name: tag }
        );

        if (hashtagError) {
          console.error("Error creating hashtag:", hashtagError);
          continue;
        }

        // Link hashtag to post
        const { error: linkError } = await supabase
          .from("post_hashtags")
          .upsert(
            { post_id: postId, hashtag_id: hashtagId },
            { onConflict: "post_id,hashtag_id" }
          );

        if (linkError) {
          console.error("Error linking hashtag:", linkError);
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["trending-hashtags"] });
    },
  });
}
