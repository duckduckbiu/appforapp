import { useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useIdentity } from "@/contexts/IdentityContext";
import type { PostData } from "@/components/posts/PostCard";

const PAGE_SIZE = 20;

interface FeedResponse {
  posts: PostData[];
  nextCursor: string | null;
}

async function fetchFeed(
  userId: string,
  cursor?: string
): Promise<FeedResponse> {
  // 获取用户关注的人
  const { data: follows } = await supabase
    .from("follows")
    .select("following_id")
    .eq("follower_id", userId);

  const followingIds = follows?.map((f) => f.following_id) || [];
  
  // 包含自己的帖子和关注的人的帖子
  const authorIds = [userId, ...followingIds];

  let query = supabase
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
    .in("author_id", authorIds)
    .eq("is_deleted", false)
    .order("created_at", { ascending: false })
    .limit(PAGE_SIZE);

  if (cursor) {
    query = query.lt("created_at", cursor);
  }

  const { data: posts, error } = await query;

  if (error) throw error;

  // 获取当前用户的点赞和收藏状态
  const postIds = posts?.map((p) => p.id) || [];
  
  const [likesRes, collectionsRes] = await Promise.all([
    supabase
      .from("post_likes")
      .select("post_id")
      .eq("user_id", userId)
      .in("post_id", postIds),
    supabase
      .from("post_collections")
      .select("post_id")
      .eq("user_id", userId)
      .in("post_id", postIds),
  ]);

  const likedPostIds = new Set(likesRes.data?.map((l) => l.post_id) || []);
  const collectedPostIds = new Set(collectionsRes.data?.map((c) => c.post_id) || []);

  const formattedPosts: PostData[] = (posts || []).map((post) => ({
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
    is_liked: likedPostIds.has(post.id),
    is_collected: collectedPostIds.has(post.id),
  }));

  const nextCursor = formattedPosts.length === PAGE_SIZE
    ? formattedPosts[formattedPosts.length - 1].created_at
    : null;

  return { posts: formattedPosts, nextCursor };
}

export function useFeed() {
  const { currentIdentity } = useIdentity();
  const userId = currentIdentity?.profile?.id;

  return useInfiniteQuery({
    queryKey: ["feed", userId],
    queryFn: ({ pageParam }) => fetchFeed(userId!, pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    enabled: !!userId,
    staleTime: 1000 * 60, // 1 minute
  });
}

// 点赞 Hook
export function usePostLike() {
  const queryClient = useQueryClient();
  const { currentIdentity } = useIdentity();
  const userId = currentIdentity?.profile?.id;

  return useMutation({
    mutationFn: async ({ postId, isLiked }: { postId: string; isLiked: boolean }) => {
      if (!userId) throw new Error("未登录");

      if (isLiked) {
        // 取消点赞
        const { error } = await supabase
          .from("post_likes")
          .delete()
          .eq("post_id", postId)
          .eq("user_id", userId);
        if (error) throw error;
      } else {
        // 点赞
        const { error } = await supabase
          .from("post_likes")
          .insert({ post_id: postId, user_id: userId });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["feed"] });
    },
  });
}

// 收藏 Hook
export function usePostCollection() {
  const queryClient = useQueryClient();
  const { currentIdentity } = useIdentity();
  const userId = currentIdentity?.profile?.id;

  return useMutation({
    mutationFn: async ({ postId, isCollected }: { postId: string; isCollected: boolean }) => {
      if (!userId) throw new Error("未登录");

      if (isCollected) {
        // 取消收藏
        const { error } = await supabase
          .from("post_collections")
          .delete()
          .eq("post_id", postId)
          .eq("user_id", userId);
        if (error) throw error;
      } else {
        // 收藏
        const { error } = await supabase
          .from("post_collections")
          .insert({ post_id: postId, user_id: userId });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["feed"] });
    },
  });
}

// 删除帖子 Hook
export function useDeletePost() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (postId: string) => {
      const { error } = await supabase
        .from("posts")
        .update({ is_deleted: true })
        .eq("id", postId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["feed"] });
    },
  });
}
