import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useIdentity } from "@/contexts/IdentityContext";
import type { PostData } from "@/components/posts/PostCard";

export function usePost(postId: string | undefined) {
  const { currentIdentity } = useIdentity();
  const userId = currentIdentity?.profile?.id;

  return useQuery({
    queryKey: ["post", postId],
    queryFn: async (): Promise<PostData | null> => {
      if (!postId) return null;

      const { data: post, error } = await supabase
        .from("posts")
        .select(`
          id,
          content,
          visibility,
          likes_count,
          comments_count,
          shares_count,
          collections_count,
          created_at,
          author:profiles!posts_author_id_fkey (
            id,
            display_name,
            unique_username,
            avatar_url
          ),
          media:post_media (
            id,
            media_type,
            media_url,
            thumbnail_url
          )
        `)
        .eq("id", postId)
        .eq("is_deleted", false)
        .single();

      if (error) throw error;
      if (!post) return null;

      // 获取当前用户的点赞和收藏状态
      let isLiked = false;
      let isCollected = false;

      if (userId) {
        const [likeRes, collectRes] = await Promise.all([
          supabase
            .from("post_likes")
            .select("id")
            .eq("post_id", postId)
            .eq("user_id", userId)
            .maybeSingle(),
          supabase
            .from("post_collections")
            .select("id")
            .eq("post_id", postId)
            .eq("user_id", userId)
            .maybeSingle(),
        ]);

        isLiked = !!likeRes.data;
        isCollected = !!collectRes.data;
      }

      return {
        id: post.id,
        content: post.content,
        visibility: post.visibility,
        likes_count: post.likes_count,
        comments_count: post.comments_count,
        shares_count: post.shares_count,
        collections_count: post.collections_count,
        created_at: post.created_at,
        author: post.author as PostData["author"],
        media: (post.media || []) as PostData["media"],
        is_liked: isLiked,
        is_collected: isCollected,
      };
    },
    enabled: !!postId,
  });
}
