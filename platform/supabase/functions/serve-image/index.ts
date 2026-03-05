import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { checkRateLimit, getClientIP, rateLimitResponse } from "../_shared/rate-limiter.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// 已知的存储桶名称
const KNOWN_BUCKETS = ["post-media", "post-media-protected", "avatars", "covers", "message-images", "message-files"];

// 速率限制配置：每分钟 120 次请求（图片访问频繁）
const RATE_LIMIT_CONFIG = { windowMs: 60 * 1000, maxRequests: 120 };

Deno.serve(async (req) => {
  // Handle CORS preflight
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
    const url = new URL(req.url);
    const mediaId = url.searchParams.get("mediaId");

    if (!mediaId) {
      return new Response(JSON.stringify({ error: "mediaId is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Create Supabase client with service role for storage access
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Get user from authorization header OR token query param
    let userId: string | null = null;
    const authHeader = req.headers.get("Authorization");
    const tokenFromQuery = url.searchParams.get("token");
    const token = authHeader?.replace("Bearer ", "") || tokenFromQuery;
    
    if (token) {
      const supabaseUser = createClient(
        Deno.env.get("SUPABASE_URL") ?? "",
        Deno.env.get("SUPABASE_ANON_KEY") ?? "",
        {
          global: { headers: { Authorization: `Bearer ${token}` } },
        }
      );
      const { data: { user }, error: authError } = await supabaseUser.auth.getUser();
      if (authError) {
        console.error("Auth error:", authError.message);
      }
      userId = user?.id ?? null;
    }

    // Query post_media to get image info
    const { data: mediaData, error: mediaError } = await supabaseAdmin
      .from("post_media")
      .select("id, post_id, media_url, original_media_url, media_type")
      .eq("id", mediaId)
      .single();

    if (mediaError || !mediaData) {
      console.error("Media not found:", mediaError);
      return new Response(JSON.stringify({ error: "Media not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Canvas 安全打码方案：严格权限检查
    // 默认返回打码图 (media_url)，只有授权用户才能获取原图 (original_media_url)
    let imageUrl = mediaData.media_url;
    let shouldServeOriginal = false;

    // 检查是否有原图（表示有打码内容）
    if (mediaData.original_media_url) {
      if (userId) {
        // Check if user is the post author
        const { data: postData } = await supabaseAdmin
          .from("posts")
          .select("author_id")
          .eq("id", mediaData.post_id)
          .single();

        if (postData?.author_id === userId) {
          shouldServeOriginal = true;
          console.log(`User ${userId} is author - serving original`);
        } else {
          // Check if user has unlocked this post
          const { data: unlockData } = await supabaseAdmin
            .from("post_unlock_status")
            .select("id")
            .eq("post_id", mediaData.post_id)
            .eq("user_id", userId)
            .maybeSingle();

          if (unlockData) {
            shouldServeOriginal = true;
            console.log(`User ${userId} has unlocked post ${mediaData.post_id} - serving original`);
          }
        }
      }

      // 只有作者或已解锁用户才能获取原图
      if (shouldServeOriginal) {
        imageUrl = mediaData.original_media_url;
        console.log(`Authorized access - serving original image`);
      } else {
        console.log(`Unauthorized access - serving masked image`);
      }
    }

    console.log(`Serving image for mediaId=${mediaId}, userId=${userId}, shouldServeOriginal=${shouldServeOriginal}`);

    // 智能解析 URL，支持多种格式
    // 格式1: /storage/v1/object/public/bucket/path
    // 格式2: /storage/v1/object/bucket/path (私有桶)
    const urlParts = imageUrl.split("/storage/v1/object/");
    if (urlParts.length < 2) {
      // Fallback: try to serve as external URL
      const response = await fetch(imageUrl);
      const blob = await response.blob();
      return new Response(blob, {
        headers: {
          ...corsHeaders,
          "Content-Type": response.headers.get("Content-Type") || "image/jpeg",
          "Cache-Control": "private, max-age=300",
        },
      });
    }

    // 智能解析 bucket 和 path
    const pathPart = urlParts[1];
    const pathSegments = pathPart.split("/");
    
    let bucketName: string;
    let filePath: string;

    // 检查第一个 segment 是否是已知 bucket
    if (KNOWN_BUCKETS.includes(pathSegments[0])) {
      // 新格式: /object/bucket/path
      bucketName = pathSegments[0];
      filePath = pathSegments.slice(1).join("/").split("?")[0];
    } else if (pathSegments[0] === "public" || pathSegments[0] === "sign") {
      // 旧格式: /object/public/bucket/path 或 /object/sign/bucket/path
      bucketName = pathSegments[1];
      filePath = pathSegments.slice(2).join("/").split("?")[0];
    } else {
      // 未知格式，尝试作为 bucket 名
      console.warn(`Unknown URL format, first segment: ${pathSegments[0]}`);
      bucketName = pathSegments[0];
      filePath = pathSegments.slice(1).join("/").split("?")[0];
    }

    console.log(`Fetching from bucket=${bucketName}, path=${filePath}`);

    // Download the image from storage
    const { data: fileData, error: downloadError } = await supabaseAdmin.storage
      .from(bucketName)
      .download(filePath);

    if (downloadError || !fileData) {
      console.error("Failed to download image:", downloadError);
      return new Response(JSON.stringify({ error: "Failed to fetch image" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Determine content type
    const extension = filePath.split(".").pop()?.toLowerCase();
    const contentTypeMap: Record<string, string> = {
      jpg: "image/jpeg",
      jpeg: "image/jpeg",
      png: "image/png",
      gif: "image/gif",
      webp: "image/webp",
    };
    const contentType = contentTypeMap[extension || ""] || "image/jpeg";

    // 短期私有缓存
    const cacheControl = "private, max-age=300";

    return new Response(fileData, {
      headers: {
        ...corsHeaders,
        "Content-Type": contentType,
        "Cache-Control": cacheControl,
      },
    });
  } catch (error) {
    console.error("Error serving image:", error);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
