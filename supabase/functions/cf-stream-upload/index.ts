import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const CLOUDFLARE_ACCOUNT_ID = Deno.env.get("CLOUDFLARE_ACCOUNT_ID");
const CLOUDFLARE_STREAM_API_TOKEN = Deno.env.get("CLOUDFLARE_STREAM_API_TOKEN");
const CLOUDFLARE_STREAM_SIGNING_KEY = Deno.env.get("CLOUDFLARE_STREAM_SIGNING_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

interface UploadRequest {
  action: "upload" | "check_status" | "schedule_batch" | "get_playback_url" | "get_signed_url";
  channel_id?: string;
  channel_ids?: string[];
  cf_stream_uid?: string;
  batch_size?: number;
  expires_in_seconds?: number;
}

// HMAC-SHA256 signing for Cloudflare Stream tokens
async function signToken(payload: string, secret: string): Promise<string> {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(secret);
  const messageData = encoder.encode(payload);
  
  const key = await crypto.subtle.importKey(
    "raw",
    keyData,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  
  const signature = await crypto.subtle.sign("HMAC", key, messageData);
  const signatureArray = Array.from(new Uint8Array(signature));
  return signatureArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// Generate signed playback URL for VOD security
async function generateSignedPlaybackUrl(
  cfStreamUid: string, 
  expiresInSeconds: number = 3600
): Promise<{ signedUrl: string; expiresAt: number } | null> {
  if (!CLOUDFLARE_STREAM_SIGNING_KEY) {
    console.log("[CF-Stream] No signing key configured, returning unsigned URL");
    return null;
  }

  const expiresAt = Math.floor(Date.now() / 1000) + expiresInSeconds;
  const tokenPayload = JSON.stringify({
    sub: cfStreamUid,
    kid: CLOUDFLARE_ACCOUNT_ID,
    exp: expiresAt,
    accessRules: [
      { type: "any", action: "allow" }
    ]
  });

  // Base64URL encode the payload
  const base64Payload = btoa(tokenPayload)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

  const signature = await signToken(base64Payload, CLOUDFLARE_STREAM_SIGNING_KEY);
  
  const signedUrl = `https://customer-${CLOUDFLARE_ACCOUNT_ID}.cloudflarestream.com/${cfStreamUid}/manifest/video.m3u8?token=${base64Payload}.${signature}`;
  
  return { signedUrl, expiresAt };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify authentication
    const authHeader = req.headers.get("authorization");
    const cronSecret = req.headers.get("x-supabase-cron-secret");
    
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    
    // Check if it's a cron job or authenticated request
    if (!cronSecret && authHeader) {
      const token = authHeader.replace("Bearer ", "");
      const { data: { user }, error: authError } = await supabase.auth.getUser(token);
      
      if (authError || !user) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      
      // Check if user is admin
      const { data: isAdmin } = await supabase.rpc("is_admin", { uid: user.id });
      if (!isAdmin) {
        return new Response(JSON.stringify({ error: "Admin access required" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    if (!CLOUDFLARE_ACCOUNT_ID || !CLOUDFLARE_STREAM_API_TOKEN) {
      return new Response(JSON.stringify({ error: "Cloudflare credentials not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body: UploadRequest = await req.json();
    const { action } = body;

    console.log(`[CF-Stream] Action: ${action}`);

    switch (action) {
      case "upload":
        return await handleUpload(supabase, body.channel_id!);
      
      case "check_status":
        return await handleCheckStatus(supabase, body.cf_stream_uid!);
      
      case "schedule_batch":
        return await handleScheduleBatch(supabase, body.batch_size || 10);
      
      case "get_playback_url":
        return await handleGetPlaybackUrl(body.cf_stream_uid!);
      
      case "get_signed_url":
        return await handleGetSignedUrl(body.cf_stream_uid!, body.expires_in_seconds);
      
      default:
        return new Response(JSON.stringify({ error: "Invalid action" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }
  } catch (error) {
    console.error("[CF-Stream] Error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

async function handleUpload(supabase: any, channelId: string) {
  console.log(`[CF-Stream] Starting upload for channel: ${channelId}`);

  // Get channel info
  const { data: channel, error: channelError } = await supabase
    .from("m3u_channels")
    .select("id, name, stream_url, is_vod, cf_stream_uid")
    .eq("id", channelId)
    .single();

  if (channelError || !channel) {
    return new Response(JSON.stringify({ error: "Channel not found" }), {
      status: 404,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (!channel.is_vod) {
    return new Response(JSON.stringify({ error: "Channel is not VOD" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (channel.cf_stream_uid) {
    return new Response(JSON.stringify({ 
      error: "Channel already uploaded to Stream",
      cf_stream_uid: channel.cf_stream_uid 
    }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Create upload record
  const { data: uploadRecord, error: insertError } = await supabase
    .from("cf_stream_uploads")
    .insert({
      channel_id: channelId,
      original_url: channel.stream_url,
      status: "uploading",
      progress_percent: 0,
      started_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (insertError) {
    console.error("[CF-Stream] Failed to create upload record:", insertError);
    return new Response(JSON.stringify({ error: "Failed to create upload record" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    // Upload to Cloudflare Stream via URL copy with signed URLs enabled
    const cfResponse = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/stream/copy`,
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${CLOUDFLARE_STREAM_API_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          url: channel.stream_url,
          meta: {
            name: channel.name,
            channel_id: channelId,
          },
          requireSignedURLs: CLOUDFLARE_STREAM_SIGNING_KEY ? true : false,
          allowedOrigins: ["*"],
        }),
      }
    );

    const cfData = await cfResponse.json();
    console.log("[CF-Stream] Cloudflare response:", JSON.stringify(cfData));

    if (!cfResponse.ok || !cfData.success) {
      const errorMsg = cfData.errors?.[0]?.message || "Failed to upload to Stream";
      
      await supabase
        .from("cf_stream_uploads")
        .update({
          status: "error",
          error_message: errorMsg,
          progress_percent: 0,
        })
        .eq("id", uploadRecord.id);

      return new Response(JSON.stringify({ error: errorMsg }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const streamUid = cfData.result.uid;
    const streamStatus = cfData.result.status?.state || "downloading";
    const pctComplete = cfData.result.status?.pctComplete 
      ? parseFloat(cfData.result.status.pctComplete) 
      : 0;

    // Update upload record
    await supabase
      .from("cf_stream_uploads")
      .update({
        cf_stream_uid: streamUid,
        status: streamStatus === "ready" ? "ready" : "processing",
        progress_percent: pctComplete,
        metadata: cfData.result,
      })
      .eq("id", uploadRecord.id);

    // Update channel with Stream info
    await supabase
      .from("m3u_channels")
      .update({
        cf_stream_uid: streamUid,
        cf_stream_status: streamStatus,
        cf_stream_uploaded_at: new Date().toISOString(),
      })
      .eq("id", channelId);

    console.log(`[CF-Stream] Successfully initiated upload. UID: ${streamUid}`);

    return new Response(JSON.stringify({
      success: true,
      cf_stream_uid: streamUid,
      status: streamStatus,
      progress: pctComplete,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[CF-Stream] Upload error:", error);
    
    await supabase
      .from("cf_stream_uploads")
      .update({
        status: "error",
        error_message: error.message,
        progress_percent: 0,
      })
      .eq("id", uploadRecord.id);

    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
}

async function handleCheckStatus(supabase: any, cfStreamUid: string) {
  console.log(`[CF-Stream] Checking status for: ${cfStreamUid}`);

  const cfResponse = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/stream/${cfStreamUid}`,
    {
      headers: {
        "Authorization": `Bearer ${CLOUDFLARE_STREAM_API_TOKEN}`,
      },
    }
  );

  const cfData = await cfResponse.json();

  if (!cfResponse.ok || !cfData.success) {
    return new Response(JSON.stringify({ error: "Failed to get status" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const result = cfData.result;
  const status = result.status?.state || "unknown";
  const isReady = status === "ready";
  const pctComplete = result.status?.pctComplete 
    ? parseFloat(result.status.pctComplete) 
    : (isReady ? 100 : 0);

  // Update upload record with progress
  await supabase
    .from("cf_stream_uploads")
    .update({
      status: isReady ? "ready" : status === "error" ? "error" : "processing",
      progress_percent: pctComplete,
      metadata: result,
      ...(isReady && { completed_at: new Date().toISOString() }),
    })
    .eq("cf_stream_uid", cfStreamUid);

  // Update channel if ready
  if (isReady) {
    const playbackUrl = `https://customer-${CLOUDFLARE_ACCOUNT_ID}.cloudflarestream.com/${cfStreamUid}/manifest/video.m3u8`;
    
    await supabase
      .from("m3u_channels")
      .update({
        cf_stream_status: "ready",
        cf_stream_url: playbackUrl,
        cf_stream_duration_seconds: result.duration ? Math.floor(result.duration) : null,
        cf_stream_size_bytes: result.size || null,
      })
      .eq("cf_stream_uid", cfStreamUid);
  }

  return new Response(JSON.stringify({
    cf_stream_uid: cfStreamUid,
    status,
    progress: pctComplete,
    duration: result.duration,
    size: result.size,
    playback: result.playback,
    isReady,
  }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function handleScheduleBatch(supabase: any, batchSize: number) {
  console.log(`[CF-Stream] Scheduling batch of ${batchSize} VODs`);

  // Check how many are currently processing
  const { count: processingCount } = await supabase
    .from("cf_stream_uploads")
    .select("*", { count: "exact", head: true })
    .in("status", ["uploading", "processing"]);

  const maxConcurrent = 5;
  const available = Math.max(0, maxConcurrent - (processingCount || 0));

  if (available === 0) {
    return new Response(JSON.stringify({
      message: "Max concurrent uploads reached",
      processing: processingCount,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Get VODs that need uploading (prioritize by view count if available)
  const { data: vodsToUpload, error } = await supabase
    .from("m3u_channels")
    .select("id, name, stream_url")
    .eq("is_vod", true)
    .is("cf_stream_uid", null)
    .limit(Math.min(batchSize, available));

  if (error || !vodsToUpload?.length) {
    return new Response(JSON.stringify({
      message: "No VODs to upload",
      error: error?.message,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Queue uploads
  const results = [];
  for (const vod of vodsToUpload) {
    try {
      // Create upload record
      await supabase.from("cf_stream_uploads").insert({
        channel_id: vod.id,
        original_url: vod.stream_url,
        status: "queued",
        progress_percent: 0,
      });
      results.push({ id: vod.id, name: vod.name, status: "queued" });
    } catch (err) {
      results.push({ id: vod.id, name: vod.name, status: "error", error: err.message });
    }
  }

  console.log(`[CF-Stream] Queued ${results.length} VODs for upload`);

  return new Response(JSON.stringify({
    scheduled: results.length,
    results,
  }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function handleGetPlaybackUrl(cfStreamUid: string) {
  // HLS URL format for Cloudflare Stream
  const hlsUrl = `https://customer-${CLOUDFLARE_ACCOUNT_ID}.cloudflarestream.com/${cfStreamUid}/manifest/video.m3u8`;
  const dashUrl = `https://customer-${CLOUDFLARE_ACCOUNT_ID}.cloudflarestream.com/${cfStreamUid}/manifest/video.mpd`;
  const thumbnailUrl = `https://customer-${CLOUDFLARE_ACCOUNT_ID}.cloudflarestream.com/${cfStreamUid}/thumbnails/thumbnail.jpg`;

  return new Response(JSON.stringify({
    hls: hlsUrl,
    dash: dashUrl,
    thumbnail: thumbnailUrl,
    embed: `https://customer-${CLOUDFLARE_ACCOUNT_ID}.cloudflarestream.com/${cfStreamUid}/iframe`,
  }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function handleGetSignedUrl(cfStreamUid: string, expiresInSeconds: number = 3600) {
  console.log(`[CF-Stream] Generating signed URL for: ${cfStreamUid}`);
  
  const result = await generateSignedPlaybackUrl(cfStreamUid, expiresInSeconds);
  
  if (!result) {
    // Return unsigned URL if signing is not configured
    const unsignedUrl = `https://customer-${CLOUDFLARE_ACCOUNT_ID}.cloudflarestream.com/${cfStreamUid}/manifest/video.m3u8`;
    return new Response(JSON.stringify({
      url: unsignedUrl,
      signed: false,
      message: "Signing key not configured, returning unsigned URL"
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify({
    url: result.signedUrl,
    signed: true,
    expiresAt: result.expiresAt,
    expiresIn: expiresInSeconds,
  }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
