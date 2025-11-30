import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { encode as base64Encode } from "https://deno.land/std@0.177.0/encoding/base64.ts";
import { createHmac } from "https://deno.land/std@0.177.0/node/crypto.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const streamProxySecret = Deno.env.get("STREAM_PROXY_SECRET") || "default-secret";

interface TokenRequest {
  action: "generate" | "validate";
  content_id?: string;
  content_type?: "live" | "vod";
  token?: string;
  ip_address?: string;
}

interface TokenPayload {
  uid: string; // user_id
  vid: string; // content_id
  exp: number; // expiration timestamp
  perm: {
    can_play: boolean;
    max_quality: string;
  };
  iat: number; // issued at
}

function generateToken(payload: TokenPayload): string {
  const header = { alg: "HS256", typ: "JWT" };
  
  const encodedHeader = base64Encode(JSON.stringify(header))
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
  
  const encodedPayload = base64Encode(JSON.stringify(payload))
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
  
  const signatureInput = `${encodedHeader}.${encodedPayload}`;
  const signature = createHmac("sha256", streamProxySecret)
    .update(signatureInput)
    .digest("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
  
  return `${signatureInput}.${signature}`;
}

function verifyToken(token: string): TokenPayload | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    
    const [encodedHeader, encodedPayload, signature] = parts;
    
    // Verify signature
    const signatureInput = `${encodedHeader}.${encodedPayload}`;
    const expectedSignature = createHmac("sha256", streamProxySecret)
      .update(signatureInput)
      .digest("base64")
      .replace(/=/g, "")
      .replace(/\+/g, "-")
      .replace(/\//g, "_");
    
    if (signature !== expectedSignature) {
      console.log("[PlaybackToken] Invalid signature");
      return null;
    }
    
    // Decode payload
    const payloadJson = atob(
      encodedPayload.replace(/-/g, "+").replace(/_/g, "/") + 
      "=".repeat((4 - encodedPayload.length % 4) % 4)
    );
    const payload: TokenPayload = JSON.parse(payloadJson);
    
    // Check expiration
    if (payload.exp < Date.now() / 1000) {
      console.log("[PlaybackToken] Token expired");
      return null;
    }
    
    return payload;
  } catch (error) {
    console.error("[PlaybackToken] Token verification error:", error);
    return null;
  }
}

function hashToken(token: string): string {
  return createHmac("sha256", streamProxySecret)
    .update(token)
    .digest("hex");
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  
  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  
  try {
    const { action, content_id, content_type, token, ip_address }: TokenRequest = await req.json();
    
    // GENERATE TOKEN
    if (action === "generate") {
      // Validate auth
      const authHeader = req.headers.get("Authorization");
      if (!authHeader) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      
      const jwtToken = authHeader.replace("Bearer ", "");
      const { data: { user }, error: authError } = await supabase.auth.getUser(jwtToken);
      
      if (authError || !user) {
        return new Response(JSON.stringify({ error: "Invalid token" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      
      // Check subscription status
      const { data: subData } = await supabase
        .rpc("get_subscription_status", { p_user_id: user.id });
      
      const subscription = subData?.[0];
      
      if (!subscription?.can_play) {
        return new Response(JSON.stringify({ 
          error: "No active subscription",
          subscription_required: true,
          status: subscription?.status || "none"
        }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      
      // Determine permissions based on subscription
      const permissions = {
        can_play: true,
        max_quality: "1080p", // Could vary by plan
      };
      
      // Generate token
      const expiresIn = content_type === "vod" ? 4 * 60 * 60 : 60 * 60; // 4h for VOD, 1h for live
      const now = Math.floor(Date.now() / 1000);
      
      const payload: TokenPayload = {
        uid: user.id,
        vid: content_id || "*",
        exp: now + expiresIn,
        perm: permissions,
        iat: now,
      };
      
      const playbackToken = generateToken(payload);
      const tokenHash = hashToken(playbackToken);
      
      // Store token in database
      await supabase.from("playback_tokens").insert({
        user_id: user.id,
        token_hash: tokenHash,
        content_id: content_id || null,
        content_type: content_type || "live",
        permissions,
        ip_address: req.headers.get("x-forwarded-for") || req.headers.get("cf-connecting-ip"),
        expires_at: new Date((now + expiresIn) * 1000).toISOString(),
        max_uses: content_type === "vod" ? 1000 : 500,
      });
      
      console.log(`[PlaybackToken] Generated token for user ${user.id}, content: ${content_id || "*"}`);
      
      return new Response(JSON.stringify({
        token: playbackToken,
        expires_at: new Date((now + expiresIn) * 1000).toISOString(),
        permissions,
      }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    
    // VALIDATE TOKEN
    if (action === "validate") {
      if (!token) {
        return new Response(JSON.stringify({ valid: false, error: "Token required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      
      // Verify JWT signature and expiration
      const payload = verifyToken(token);
      
      if (!payload) {
        return new Response(JSON.stringify({ valid: false, error: "Invalid or expired token" }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      
      // Check content permission
      if (content_id && payload.vid !== "*" && payload.vid !== content_id) {
        return new Response(JSON.stringify({ valid: false, error: "Content not permitted" }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      
      // Verify against database
      const tokenHash = hashToken(token);
      const { data: dbResult } = await supabase.rpc("validate_playback_token", {
        p_token_hash: tokenHash,
        p_ip_address: ip_address || null,
      });
      
      const validation = dbResult?.[0];
      
      if (!validation?.valid) {
        return new Response(JSON.stringify({ 
          valid: false, 
          error: validation?.error_message || "Token validation failed" 
        }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      
      return new Response(JSON.stringify({
        valid: true,
        user_id: payload.uid,
        permissions: payload.perm,
        expires_at: new Date(payload.exp * 1000).toISOString(),
      }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    
    return new Response(JSON.stringify({ error: "Invalid action" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
    
  } catch (error) {
    console.error("[PlaybackToken] Error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
