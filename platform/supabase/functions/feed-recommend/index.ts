import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const PAGE_SIZE = 20;

interface RecommendRequest {
  cursor?: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { cursor } = await req.json() as RecommendRequest;

    // 并行获取关注和好友列表
    const [followsRes, friendsRes] = await Promise.all([
      supabase.from("follows").select("following_id").eq("follower_id", user.id),
      supabase.from("friendships").select("friend_id").eq("user_id", user.id),
    ]);

    const followingIds = new Set(followsRes.data?.map((f: any) => f.following_id) || []);
    const friendIds = new Set(friendsRes.data?.map((f: any) => f.friend_id) || []);

    // 获取更多帖子用于排序（获取3倍以便排序后取前PAGE_SIZE个）
    const fetchLimit = PAGE_SIZE * 3;

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
        author_id,
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
      .is("scheduled_at", null)
      .order("created_at", { ascending: false })
      .limit(fetchLimit);

    if (cursor) {
      const [, createdAt] = cursor.split("|");
      if (createdAt) {
        query = query.lt("created_at", createdAt);
      }
    }

    const { data: posts, error } = await query;
    if (error) throw error;

    if (!posts || posts.length === 0) {
      return new Response(JSON.stringify({ posts: [], nextCursor: null }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 计算每个帖子的推荐分数
    const now = Date.now();
    const scoredPosts = posts.map((post: any) => {
      const authorId = post.author_id;
      const createdAt = new Date(post.created_at).getTime();
      const ageHours = (now - createdAt) / (1000 * 60 * 60);

      // 时间衰减分数 (30%)
      const timeScore = Math.max(0, 1 - Math.log10(1 + ageHours / 24) / 2) * 0.3;

      // 互动热度分数 (30%)
      const engagementRaw =
        (post.likes_count || 0) * 1 +
        (post.comments_count || 0) * 2 +
        (post.shares_count || 0) * 3;
      const engagementScore = Math.min(1, Math.log10(1 + engagementRaw) / 3) * 0.3;

      // 关注关系分数 (20%)
      const followScore = followingIds.has(authorId) ? 0.2 : 0;

      // 好友关系分数 (15%)
      const friendScore = friendIds.has(authorId) ? 0.15 : 0;

      // 内容类型分数 (5%)
      const hasMedia = post.media && post.media.length > 0;
      const contentScore = hasMedia ? 0.05 : 0;

      const totalScore = timeScore + engagementScore + followScore + friendScore + contentScore;

      return { post, score: totalScore };
    });

    // 按分数排序
    scoredPosts.sort((a, b) => b.score - a.score);

    // 取前 PAGE_SIZE 个
    const topPosts = scoredPosts.slice(0, PAGE_SIZE);
    const postIds = topPosts.map((p) => p.post.id);

    // 获取用户的点赞和收藏状态
    const [likesRes, collectionsRes] = await Promise.all([
      supabase
        .from("post_likes")
        .select("post_id")
        .eq("user_id", user.id)
        .in("post_id", postIds),
      supabase
        .from("post_collections")
        .select("post_id")
        .eq("user_id", user.id)
        .in("post_id", postIds),
    ]);

    const likedPostIds = new Set(likesRes.data?.map((l: any) => l.post_id) || []);
    const collectedPostIds = new Set(collectionsRes.data?.map((c: any) => c.post_id) || []);

    // 格式化帖子
    const formattedPosts = topPosts.map(({ post }) => {
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
        author: author,
        media: post.media || [],
        is_liked: likedPostIds.has(post.id),
        is_collected: collectedPostIds.has(post.id),
      };
    });

    // 生成 cursor
    const lastPost = topPosts[topPosts.length - 1];
    const nextCursor =
      scoredPosts.length >= PAGE_SIZE && lastPost
        ? `${lastPost.score}|${lastPost.post.created_at}`
        : null;

    return new Response(JSON.stringify({ posts: formattedPosts, nextCursor }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    console.error("Error in feed-recommend:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
