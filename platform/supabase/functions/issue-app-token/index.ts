/**
 * issue-app-token — Edge Function
 *
 * Issues a short-lived JWT token for an app running inside Bill.ai.
 * Apps use this token to authenticate requests to their own backend.
 *
 * Flow:
 *   1. Verify caller's Supabase JWT → get user_id
 *   2. Verify app exists and is approved
 *   3. Verify user has installed the app
 *   4. Resolve app-scoped openid (NOT real user_id)
 *   5. Sign and return an App Token (1 hour TTL, sub = openid)
 *
 * Request body: { app_id: string }
 * Response: { token: string }
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.84.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// Simple JWT signing using HS256
async function signJWT(
  payload: Record<string, unknown>,
  secret: string
): Promise<string> {
  const header = { alg: "HS256", typ: "JWT" };
  const encode = (obj: unknown) =>
    btoa(JSON.stringify(obj))
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");

  const headerB64 = encode(header);
  const payloadB64 = encode(payload);
  const signingInput = `${headerB64}.${payloadB64}`;

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(signingInput)
  );

  const signatureB64 = btoa(
    String.fromCharCode(...new Uint8Array(signature))
  )
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

  return `${signingInput}.${signatureB64}`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // 1. Get caller identity from Supabase Auth JWT
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ error: "Missing authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const jwtSecret = Deno.env.get("SUPABASE_JWT_SECRET")!;

    // Create a client with the caller's JWT to verify identity
    const callerClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: authError } = await callerClient.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Invalid or expired session" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 2. Parse request body
    const { app_id } = await req.json();
    if (!app_id) {
      return new Response(
        JSON.stringify({ error: "Missing app_id" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 3. Verify app exists and is approved (service client to bypass RLS)
    const serviceClient = createClient(supabaseUrl, supabaseServiceKey);

    const { data: app, error: appError } = await serviceClient
      .from("apps")
      .select("id, slug, status")
      .eq("id", app_id)
      .single();

    if (appError || !app) {
      return new Response(
        JSON.stringify({ error: "App not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (app.status !== "approved") {
      return new Response(
        JSON.stringify({ error: "App is not approved" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 4. Verify user has installed the app
    const { data: installation } = await serviceClient
      .from("user_installed_apps")
      .select("app_id")
      .eq("user_id", user.id)
      .eq("app_id", app_id)
      .maybeSingle();

    if (!installation) {
      return new Response(
        JSON.stringify({ error: "App not installed" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 5. Get app-scoped openid (NOT real user_id)
    const { data: openid, error: openidError } = await serviceClient.rpc(
      "get_or_create_openid",
      { p_user_id: user.id, p_app_id: app.id }
    );

    if (openidError || !openid) {
      console.error("get_or_create_openid error:", openidError);
      return new Response(
        JSON.stringify({ error: "Failed to resolve openid" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 6. Sign App Token (1 hour TTL) — sub is openid, NOT real user_id
    const now = Math.floor(Date.now() / 1000);
    const token = await signJWT(
      {
        sub: openid,
        app: app.slug,
        app_id: app.id,
        iat: now,
        exp: now + 3600,
      },
      jwtSecret
    );

    return new Response(
      JSON.stringify({ token }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("issue-app-token error:", err);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
