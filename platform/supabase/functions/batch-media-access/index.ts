import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { checkRateLimit, getClientIP, rateLimitResponse } from "../_shared/rate-limiter.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// 速率限制配置：每分钟 30 次请求（批量操作更重）
const RATE_LIMIT_CONFIG = { windowMs: 60 * 1000, maxRequests: 30 };

interface MediaUnlockStatus {
  isFullyUnlocked: boolean;
  unlockedRegions: string[];
  maskRegions: any[];
}

interface MediaAccessResult {
  [postId: string]: {
    canViewOriginal: boolean;
    isOwner: boolean;
    isUnlocked: boolean;
    unlockRule: {
      unlock_mode: string;
      required_count: number;
      mask_regions: any[];
    } | null;
    unlockedRegions: string[];
    mediaUnlockStatus: { [mediaId: string]: MediaUnlockStatus };
    signedUrls: { [mediaId: string]: string };
  };
}

Deno.serve(async (req) => {
  // Handle CORS
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // 速率限制检查
  const clientIP = getClientIP(req);
  const rateLimit = checkRateLimit(clientIP, RATE_LIMIT_CONFIG);
  if (!rateLimit.allowed) {
    return rateLimitResponse(rateLimit.resetAt, corsHeaders);
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 解析请求体
    const { postIds } = await req.json();
    if (!postIds || !Array.isArray(postIds) || postIds.length === 0) {
      return new Response(
        JSON.stringify({ error: "postIds array is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 限制一次最多处理 50 个帖子
    const limitedPostIds = postIds.slice(0, 50);

    // 创建 Supabase 客户端
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // 验证用户身份
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Invalid token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const userId = user.id;

    // 批量查询：帖子作者 + 媒体信息
    const { data: postsData, error: postsError } = await supabase
      .from("posts")
      .select(`
        id,
        author_id,
        post_media (
          id,
          media_type,
          media_url,
          thumbnail_url,
          original_media_url,
          masked_media_url,
          mask_regions
        )
      `)
      .in("id", limitedPostIds);

    if (postsError) {
      console.error("Posts query error:", postsError);
      return new Response(
        JSON.stringify({ error: "Failed to fetch posts" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 批量查询：解锁规则（包含 unlock_mode）
    const { data: unlockRules, error: rulesError } = await supabase
      .from("post_unlock_rules")
      .select("post_id, unlock_mode, required_count, mask_regions")
      .in("post_id", limitedPostIds);

    if (rulesError) {
      console.error("Unlock rules query error:", rulesError);
    }

    // 批量查询：用户解锁状态（包括分区域解锁）
    const { data: unlockStatuses, error: statusError } = await supabase
      .from("post_unlock_status")
      .select("post_id, media_id, region_id")
      .eq("user_id", userId)
      .in("post_id", limitedPostIds);

    if (statusError) {
      console.error("Unlock status query error:", statusError);
    }

    // 构建映射表
    const rulesMap = new Map(unlockRules?.map(r => [r.post_id, r]) || []);
    
    // 构建解锁状态映射
    // 统一解锁：post_id 有记录且 media_id 和 region_id 都为 null
    // 分区域解锁：按 region_id 分组
    const unifiedUnlockSet = new Set<string>();
    const regionUnlockMap = new Map<string, string[]>(); // postId -> regionIds[]
    
    for (const status of unlockStatuses || []) {
      if (!status.media_id && !status.region_id) {
        // 统一解锁
        unifiedUnlockSet.add(status.post_id);
      } else if (status.region_id) {
        // 分区域解锁
        const regions = regionUnlockMap.get(status.post_id) || [];
        regions.push(status.region_id);
        regionUnlockMap.set(status.post_id, regions);
      }
    }

    // 构建结果
    const result: MediaAccessResult = {};

    for (const post of postsData || []) {
      const isOwner = post.author_id === userId;
      const unlockRule = rulesMap.get(post.id) || null;
      const unlockMode = unlockRule?.unlock_mode || "unified";
      
      // 获取已解锁的区域
      const unlockedRegions = regionUnlockMap.get(post.id) || [];
      
      // 判断是否完全解锁
      let isUnlocked = false;
      if (unlockMode === "unified") {
        isUnlocked = unifiedUnlockSet.has(post.id);
      } else {
        // 分区域模式：检查是否所有区域都已解锁
        const allRegions = unlockRule?.mask_regions || [];
        isUnlocked = allRegions.length > 0 && 
          allRegions.every((r: any) => unlockedRegions.includes(r.id));
      }
      
      const canViewOriginal = isOwner || isUnlocked;

      const signedUrls: { [mediaId: string]: string } = {};
      const mediaUnlockStatus: { [mediaId: string]: MediaUnlockStatus } = {};

      // 处理每个媒体
      if (post.post_media) {
        for (const media of post.post_media) {
          // 构建媒体级别的解锁状态
          const mediaMaskRegions = media.mask_regions || [];
          const mediaUnlockedRegions = unlockedRegions.filter((rId: string) => 
            mediaMaskRegions.some((r: any) => r.id === rId)
          );
          const isMediaFullyUnlocked = isUnlocked || 
            (mediaMaskRegions.length > 0 && mediaMaskRegions.every((r: any) => mediaUnlockedRegions.includes(r.id)));
          
          mediaUnlockStatus[media.id] = {
            isFullyUnlocked: isMediaFullyUnlocked,
            unlockedRegions: mediaUnlockedRegions,
            maskRegions: mediaMaskRegions,
          };

          // 方案 B：为所有有 original_media_url 的媒体生成 Signed URL
          // 非作者也需要加载图片，然后用 CSS 遮罩覆盖
          if (media.original_media_url) {
            // 已知的存储桶名称
            const KNOWN_BUCKETS = ["post-media", "post-media-protected", "avatars", "covers", "message-images", "message-files"];
            
            // 智能解析存储路径，支持多种格式：
            // 1. 旧格式: /storage/v1/object/public/bucket/path
            // 2. 新格式: /storage/v1/object/bucket/path (私有桶)
            let bucket: string | null = null;
            let filePath: string | null = null;
            
            const urlParts = media.original_media_url.split("/storage/v1/object/");
            if (urlParts.length === 2) {
              const pathPart = urlParts[1];
              const pathSegments = pathPart.split("/");
              
              // 检查第一个 segment 是否是已知 bucket
              if (KNOWN_BUCKETS.includes(pathSegments[0])) {
                // 新格式: /object/bucket/path
                bucket = pathSegments[0];
                filePath = pathSegments.slice(1).join("/").split("?")[0];
              } else if (pathSegments[0] === "public" || pathSegments[0] === "sign") {
                // 旧格式: /object/public/bucket/path
                bucket = pathSegments[1];
                filePath = pathSegments.slice(2).join("/").split("?")[0];
              } else {
                // 未知格式，记录警告
                console.warn(`Unknown URL format for media ${media.id}: ${media.original_media_url}`);
              }
            }
            
            if (bucket && filePath) {
              // 生成 1 小时有效期的签名 URL
              const { data: signedData, error: signedError } = await supabase.storage
                .from(bucket)
                .createSignedUrl(filePath, 3600);

              if (!signedError && signedData?.signedUrl) {
                signedUrls[media.id] = signedData.signedUrl;
              } else if (signedError) {
                console.error(`Failed to create signed URL for ${media.id}:`, signedError);
              }
            }
          }
        }
      }

      result[post.id] = {
        canViewOriginal,
        isOwner,
        isUnlocked,
        unlockRule: unlockRule ? {
          unlock_mode: unlockMode,
          required_count: unlockRule.required_count,
          mask_regions: unlockRule.mask_regions || [],
        } : null,
        unlockedRegions,
        mediaUnlockStatus,
        signedUrls,
      };
    }

    console.log(`Batch media access: processed ${limitedPostIds.length} posts for user ${userId}`);

    return new Response(
      JSON.stringify(result),
      { 
        headers: { 
          ...corsHeaders, 
          "Content-Type": "application/json",
          "Cache-Control": "private, max-age=300",
        } 
      }
    );
  } catch (error) {
    console.error("Batch media access error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
