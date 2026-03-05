import { useInfiniteQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface UserPost {
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
  isLiked?: boolean;
  isCollected?: boolean;
}

const PAGE_SIZE = 10;

async function fetchUserPosts(
  userId: string,
  currentUserId: string | undefined,
  cursor?: string
): Promise<{ posts: UserPost[]; nextCursor: string | null }> {
  let query = supabase
    .from("posts")
    .select(`
      id,
      content,
      visibility,
      created_at,
      updated_at,
      likes_count,
      comments_count,
      collections_count,
      shares_count,
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
    `)
    .eq("author_id", userId)
    .eq("is_deleted", false)
    .order("created_at", { ascending: false })
    .limit(PAGE_SIZE);

  // 如果不是自己，只显示公开帖子
  if (currentUserId !== userId) {
    query = query.eq("visibility", "public");
  }

  if (cursor) {
    query = query.lt("created_at", cursor);
  }

  const { data: posts, error } = await query;

  if (error) throw error;

  // 获取当前用户的点赞和收藏状态
  let likedPostIds: string[] = [];
  let collectedPostIds: string[] = [];

  if (currentUserId && posts && posts.length > 0) {
    const postIds = posts.map((p) => p.id);

    const [likesRes, collectionsRes] = await Promise.all([
      supabase
        .from("post_likes")
        .select("post_id")
        .eq("user_id", currentUserId)
        .in("post_id", postIds),
      supabase
        .from("post_collections")
        .select("post_id")
        .eq("user_id", currentUserId)
        .in("post_id", postIds),
    ]);

    likedPostIds = (likesRes.data || []).map((l) => l.post_id);
    collectedPostIds = (collectionsRes.data || []).map((c) => c.post_id);
  }

  const formattedPosts: UserPost[] = (posts || []).map((post) => ({
    ...post,
    author: post.author as UserPost["author"],
    media: ((post.media as any[]) || []).sort((a, b) => a.sort_order - b.sort_order),
    isLiked: likedPostIds.includes(post.id),
    isCollected: collectedPostIds.includes(post.id),
  }));

  const nextCursor =
    formattedPosts.length === PAGE_SIZE
      ? formattedPosts[formattedPosts.length - 1].created_at
      : null;

  return { posts: formattedPosts, nextCursor };
}

export function useUserPosts(userId: string | undefined, currentUserId: string | undefined) {
  return useInfiniteQuery({
    queryKey: ["userPosts", userId, currentUserId],
    queryFn: ({ pageParam }) =>
      fetchUserPosts(userId!, currentUserId, pageParam as string | undefined),
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    initialPageParam: undefined as string | undefined,
    enabled: !!userId,
  });
}
