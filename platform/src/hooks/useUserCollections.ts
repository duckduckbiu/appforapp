import { useInfiniteQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface CollectedPost {
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
  isCollected: boolean;
  collectedAt: string;
}

const PAGE_SIZE = 10;

async function fetchUserCollections(
  userId: string,
  currentUserId: string | undefined,
  cursor?: string
): Promise<{ posts: CollectedPost[]; nextCursor: string | null }> {
  let query = supabase
    .from("post_collections")
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

  const { data: collections, error } = await query;

  if (error) throw error;

  // 过滤掉已删除的帖子
  const validCollections = (collections || []).filter(
    (c) => c.post && !(c.post as any).is_deleted
  );

  // 获取当前用户的点赞状态
  let likedPostIds: string[] = [];

  if (currentUserId && validCollections.length > 0) {
    const postIds = validCollections.map((c) => (c.post as any).id);

    const { data: likes } = await supabase
      .from("post_likes")
      .select("post_id")
      .eq("user_id", currentUserId)
      .in("post_id", postIds);

    likedPostIds = (likes || []).map((l) => l.post_id);
  }

  const formattedPosts: CollectedPost[] = validCollections.map((collection) => {
    const post = collection.post as any;
    return {
      ...post,
      author: post.author,
      media: (post.media || []).sort((a: any, b: any) => a.sort_order - b.sort_order),
      isLiked: likedPostIds.includes(post.id),
      isCollected: true,
      collectedAt: collection.created_at,
    };
  });

  const nextCursor =
    validCollections.length === PAGE_SIZE
      ? validCollections[validCollections.length - 1].created_at
      : null;

  return { posts: formattedPosts, nextCursor };
}

export function useUserCollections(userId: string | undefined, currentUserId: string | undefined) {
  return useInfiniteQuery({
    queryKey: ["userCollections", userId, currentUserId],
    queryFn: ({ pageParam }) =>
      fetchUserCollections(userId!, currentUserId, pageParam as string | undefined),
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    initialPageParam: undefined as string | undefined,
    enabled: !!userId,
  });
}
