import { useInfiniteQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useIdentity } from "@/contexts/IdentityContext";
import type { PostData } from "@/components/posts/PostCard";
import { cacheFeedPosts, getCachedFeedPosts } from "@/lib/indexedDB";
import { useEffect } from "react";

const PAGE_SIZE = 20;
const FEED_STALE_TIME = 5 * 60 * 1000; // 5 分钟
const FEED_GC_TIME = 30 * 60 * 1000; // 30 分钟

interface FeedResponse {
  posts: PostData[];
  nextCursor: string | null;
}

// 简化的帖子格式化函数 - 不再预取媒体权限，权限检查移到查看器
async function formatPosts(
  posts: any[],
  userId: string
): Promise<PostData[]> {
  const postIds = posts?.map((p) => p.id) || [];
  
  if (postIds.length === 0) return [];

  // 只获取点赞/收藏状态，不再获取媒体访问权限
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

  return posts.map((post) => {
    // author 可能是数组或对象，确保返回对象
    const author = Array.isArray(post.author) ? post.author[0] : post.author;
    return {
      id: post.id,
      content: post.content,
      visibility: post.visibility,
      likes_count: post.likes_count,
      comments_count: post.comments_count,
      shares_count: post.shares_count,
      collections_count: post.collections_count,
      created_at: post.created_at,
      author: author as PostData["author"],
      media: (post.media || []) as PostData["media"],
      is_liked: likedPostIds.has(post.id),
      is_collected: collectedPostIds.has(post.id),
    };
  });
}

// 基础查询构建器
function buildBaseQuery() {
  return supabase
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
        masked_media_url,
        original_media_url,
        thumbnail_url
      )
    `)
    .eq("is_deleted", false)
    .eq("visibility", "public");
}

// 推荐 Tab - 使用服务端加权推荐算法
async function fetchRecommend(
  userId: string,
  cursor?: string
): Promise<FeedResponse> {
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData?.session?.access_token;

  if (!token) {
    return { posts: [], nextCursor: null };
  }

  const response = await fetch(
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/feed-recommend`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ cursor }),
    }
  );

  if (!response.ok) {
    throw new Error("Failed to fetch recommendations");
  }

  return response.json();
}

// 关注 Tab - 关注的人的帖子
async function fetchFollowing(
  userId: string,
  cursor?: string
): Promise<FeedResponse> {
  // 获取用户关注的人
  const { data: follows } = await supabase
    .from("follows")
    .select("following_id")
    .eq("follower_id", userId);

  const followingIds = follows?.map((f) => f.following_id) || [];
  
  if (followingIds.length === 0) {
    return { posts: [], nextCursor: null };
  }

  let query = buildBaseQuery()
    .in("author_id", followingIds)
    .order("created_at", { ascending: false })
    .limit(PAGE_SIZE);

  if (cursor) {
    query = query.lt("created_at", cursor);
  }

  const { data: posts, error } = await query;
  if (error) throw error;

  const formattedPosts = await formatPosts(posts || [], userId);
  const nextCursor = formattedPosts.length === PAGE_SIZE
    ? formattedPosts[formattedPosts.length - 1].created_at
    : null;

  return { posts: formattedPosts, nextCursor };
}

// 好友 Tab - 好友的帖子
async function fetchFriends(
  userId: string,
  cursor?: string
): Promise<FeedResponse> {
  // 获取用户的好友
  const { data: friendships } = await supabase
    .from("friendships")
    .select("friend_id")
    .eq("user_id", userId);

  const friendIds = friendships?.map((f) => f.friend_id) || [];
  
  if (friendIds.length === 0) {
    return { posts: [], nextCursor: null };
  }

  let query = buildBaseQuery()
    .in("author_id", friendIds)
    .order("created_at", { ascending: false })
    .limit(PAGE_SIZE);

  if (cursor) {
    query = query.lt("created_at", cursor);
  }

  const { data: posts, error } = await query;
  if (error) throw error;

  const postsTyped = (posts || []) as any[];
  const formattedPosts = await formatPosts(postsTyped, userId);
  const nextCursor = formattedPosts.length === PAGE_SIZE
    ? formattedPosts[formattedPosts.length - 1].created_at
    : null;

  return { posts: formattedPosts, nextCursor };
}

// 通用的缓存 Hook 包装器
function useCachedFeed(
  feedType: string,
  queryFn: (userId: string, cursor?: string) => Promise<FeedResponse>
) {
  const { currentIdentity } = useIdentity();
  const userId = currentIdentity?.profile?.id;

  const query = useInfiniteQuery({
    queryKey: ["feed", feedType, userId],
    queryFn: ({ pageParam }) => queryFn(userId!, pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    enabled: !!userId,
    staleTime: FEED_STALE_TIME,
    gcTime: FEED_GC_TIME,
  });

  // 缓存成功获取的数据到 IndexedDB
  useEffect(() => {
    if (query.data?.pages && userId) {
      const allPosts = query.data.pages.flatMap(page => page.posts);
      if (allPosts.length > 0) {
        cacheFeedPosts(userId, feedType, allPosts);
      }
    }
  }, [query.data, userId, feedType]);

  return query;
}

// 附近 Tab - 基于位置的帖子
async function fetchNearby(
  userId: string,
  cursor?: string,
  userLocation?: { latitude: number; longitude: number }
): Promise<FeedResponse> {
  // 如果没有用户位置，返回空
  if (!userLocation) {
    return { posts: [], nextCursor: null };
  }

  const { latitude, longitude } = userLocation;
  
  // 计算大约50公里范围内的坐标边界
  // 纬度1度约111公里，经度1度约111*cos(纬度)公里
  const latDelta = 50 / 111;
  const lngDelta = 50 / (111 * Math.cos(latitude * Math.PI / 180));
  
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
      latitude,
      longitude,
      location_name,
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
        masked_media_url,
        original_media_url,
        thumbnail_url
      )
    `)
    .eq("is_deleted", false)
    .eq("visibility", "public")
    .not("latitude", "is", null)
    .not("longitude", "is", null)
    .gte("latitude", latitude - latDelta)
    .lte("latitude", latitude + latDelta)
    .gte("longitude", longitude - lngDelta)
    .lte("longitude", longitude + lngDelta)
    .order("created_at", { ascending: false })
    .limit(PAGE_SIZE);

  if (cursor) {
    query = query.lt("created_at", cursor);
  }

  const { data: posts, error } = await query;
  if (error) throw error;

  // 计算距离并排序
  const postsWithDistance = (posts || []).map((post: any) => {
    const distance = calculateDistance(
      latitude,
      longitude,
      post.latitude,
      post.longitude
    );
    return { ...post, distance };
  });

  // 按距离排序
  postsWithDistance.sort((a, b) => a.distance - b.distance);

  const formattedPosts = await formatPosts(postsWithDistance, userId);
  const nextCursor = formattedPosts.length === PAGE_SIZE
    ? formattedPosts[formattedPosts.length - 1].created_at
    : null;

  return { posts: formattedPosts, nextCursor };
}

// Haversine 公式计算两点间距离（公里）
function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371; // 地球半径（公里）
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// Hooks
export function useRecommendFeed() {
  return useCachedFeed("recommend", fetchRecommend);
}

export function useFollowingFeed() {
  return useCachedFeed("following", fetchFollowing);
}

export function useFriendsFeed() {
  return useCachedFeed("friends", fetchFriends);
}

// 附近 Feed - 需要位置参数
export function useNearbyFeed(userLocation?: { latitude: number; longitude: number }) {
  const { currentIdentity } = useIdentity();
  const userId = currentIdentity?.profile?.id;

  return useInfiniteQuery({
    queryKey: ["feed", "nearby", userId, userLocation?.latitude, userLocation?.longitude],
    queryFn: ({ pageParam }) => fetchNearby(userId!, pageParam, userLocation),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    enabled: !!userId && !!userLocation,
    staleTime: FEED_STALE_TIME,
    gcTime: FEED_GC_TIME,
  });
}

// 导出获取缓存数据的工具函数（供初始化时使用）
export { getCachedFeedPosts } from "@/lib/indexedDB";
