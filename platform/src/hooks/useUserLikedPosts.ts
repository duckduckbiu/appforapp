import { useInfiniteQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface LikedPost {
  id: string;
  content: string | null;
  visibility: string;
  created_at: string;
  updated_at: string;
  likes_count: number;
  comments_count: number;
  collections_count: number;
  shares_count: number;
  author: {
    id: string;
    display_name: string | null;
    unique_username: string;
    avatar_url: string | null;
  };
  media: Array<{
    id: string;
    media_type: string;
    media_url: string;
    thumbnail_url: string | null;
    masked_media_url: string | null;
    original_media_url: string | null;
    mask_regions: any;
    sort_order: number;
  }>;
  isLiked: boolean;
  isCollected?: boolean;
  likedAt: string;
}

const PAGE_SIZE = 10;

async function fetchUserLikedPosts(
  userId: string,
  currentUserId: string | undefined,
  cursor?: string
): Promise<{ posts: LikedPost[]; nextCursor: string | null }> {
  let query = supabase
    .from("post_likes")
    .select(`
      id,
      created_at,
      post:posts (
        id,
        content,
        visibility,
        created_at,
        updated_at,
        likes_count,
        comments_count,
        collections_count,
        shares_count,
        is_deleted,
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
          thumbnail_url,
          masked_media_url,
          original_media_url,
          mask_regions,
          sort_order
        )
      )
    `)
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(PAGE_SIZE);

  if (cursor) {
    query = query.lt("created_at", cursor);
  }

  const { data: likes, error } = await query;

  if (error) throw error;

  // 过滤掉已删除的帖子和非公开帖子（除非是自己的）
  const validLikes = (likes || []).filter((l) => {
    const post = l.post as any;
    if (!post || post.is_deleted) return false;
    if (post.visibility !== "public" && post.author?.id !== currentUserId) return false;
    return true;
  });

  // 获取当前用户的收藏状态
  let collectedPostIds: string[] = [];

  if (currentUserId && validLikes.length > 0) {
    const postIds = validLikes.map((l) => (l.post as any).id);

    const { data: collections } = await supabase
      .from("post_collections")
      .select("post_id")
      .eq("user_id", currentUserId)
      .in("post_id", postIds);

    collectedPostIds = (collections || []).map((c) => c.post_id);
  }

  const formattedPosts: LikedPost[] = validLikes.map((like) => {
    const post = like.post as any;
    return {
      ...post,
      author: post.author,
      media: (post.media || []).sort((a: any, b: any) => a.sort_order - b.sort_order),
      isLiked: true,
      isCollected: collectedPostIds.includes(post.id),
      likedAt: like.created_at,
    };
  });

  const nextCursor =
    validLikes.length === PAGE_SIZE
      ? validLikes[validLikes.length - 1].created_at
      : null;

  return { posts: formattedPosts, nextCursor };
}

export function useUserLikedPosts(userId: string | undefined, currentUserId: string | undefined) {
  return useInfiniteQuery({
    queryKey: ["userLikedPosts", userId, currentUserId],
    queryFn: ({ pageParam }) =>
      fetchUserLikedPosts(userId!, currentUserId, pageParam as string | undefined),
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    initialPageParam: undefined as string | undefined,
    enabled: !!userId,
  });
}
