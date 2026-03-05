import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { checkRateLimit, getClientIP, rateLimitResponse } from "../_shared/rate-limiter.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// 速率限制配置：每分钟 60 次请求
const RATE_LIMIT_CONFIG = { windowMs: 60 * 1000, maxRequests: 60 };

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  // 速率限制检查
  const clientIP = getClientIP(req);
  const rateLimit = checkRateLimit(clientIP, RATE_LIMIT_CONFIG);
  if (!rateLimit.allowed) {
    return rateLimitResponse(rateLimit.resetAt, corsHeaders);
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!

    // Get auth token from request
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Create client with user's auth token to verify identity
    const supabaseUser = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    })

    // Get current user
    const { data: { user }, error: authError } = await supabaseUser.auth.getUser()
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Parse request body
    const { postId, mediaId } = await req.json()
    
    if (!postId || !mediaId) {
      return new Response(
        JSON.stringify({ error: 'Missing postId or mediaId' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Create service role client for protected operations
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)

    // Check if user is the post author (authors can always see their own content)
    const { data: post } = await supabaseAdmin
      .from('posts')
      .select('author_id')
      .eq('id', postId)
      .single()

    const isAuthor = post?.author_id === user.id

    // If not author, check unlock status
    if (!isAuthor) {
      // Check if user has unlocked this post
      const { data: unlockStatus } = await supabaseAdmin
        .from('post_unlock_status')
        .select('id')
        .eq('post_id', postId)
        .eq('user_id', user.id)
        .single()

      if (!unlockStatus) {
        // Check if post actually has unlock rules
        const { data: unlockRule } = await supabaseAdmin
          .from('post_unlock_rules')
          .select('id')
          .eq('post_id', postId)
          .single()

        if (unlockRule) {
          return new Response(
            JSON.stringify({ error: 'Content locked. Like the post to unlock.' }),
            { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }
        // No unlock rules = content is public
      }
    }

    // Get the media record
    const { data: media, error: mediaError } = await supabaseAdmin
      .from('post_media')
      .select('original_media_url')
      .eq('id', mediaId)
      .eq('post_id', postId)
      .single()

    if (mediaError || !media) {
      return new Response(
        JSON.stringify({ error: 'Media not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (!media.original_media_url) {
      // No protected original - return the public URL
      const { data: publicMedia } = await supabaseAdmin
        .from('post_media')
        .select('media_url')
        .eq('id', mediaId)
        .single()
      
      return new Response(
        JSON.stringify({ url: publicMedia?.media_url }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Extract the file path from the original_media_url
    // URL format: https://.../storage/v1/object/public/post-media-protected/path/to/file
    const urlParts = media.original_media_url.split('/post-media-protected/')
    if (urlParts.length < 2) {
      return new Response(
        JSON.stringify({ error: 'Invalid media URL format' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    
    const filePath = urlParts[1]

    // Generate a signed URL for the protected file (valid for 1 hour)
    const { data: signedUrlData, error: signedUrlError } = await supabaseAdmin
      .storage
      .from('post-media-protected')
      .createSignedUrl(filePath, 3600) // 1 hour expiry

    if (signedUrlError || !signedUrlData) {
      console.error('Failed to create signed URL:', signedUrlError)
      return new Response(
        JSON.stringify({ error: 'Failed to generate access URL' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    return new Response(
      JSON.stringify({ url: signedUrlData.signedUrl }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error in get-unlocked-media:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
