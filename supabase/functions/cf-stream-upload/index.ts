import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const CLOUDFLARE_ACCOUNT_ID = Deno.env.get("CLOUDFLARE_ACCOUNT_ID");
const CLOUDFLARE_STREAM_API_TOKEN = Deno.env.get("CLOUDFLARE_STREAM_API_TOKEN");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

interface UploadRequest {
  action: "upload" | "check_status" | "schedule_batch" | "get_playback_url";
  channel_id?: string;
  channel_ids?: string[];
  cf_stream_uid?: string;
  batch_size?: number;
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
    // Upload to Cloudflare Stream via URL copy
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
          requireSignedURLs: false,
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
        })
        .eq("id", uploadRecord.id);

      return new Response(JSON.stringify({ error: errorMsg }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const streamUid = cfData.result.uid;
    const streamStatus = cfData.result.status?.state || "downloading";

    // Update upload record
    await supabase
      .from("cf_stream_uploads")
      .update({
        cf_stream_uid: streamUid,
        status: streamStatus === "ready" ? "ready" : "processing",
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

    await supabase
      .from("cf_stream_uploads")
      .update({
        status: "ready",
        completed_at: new Date().toISOString(),
        metadata: result,
      })
      .eq("cf_stream_uid", cfStreamUid);
  }

  return new Response(JSON.stringify({
    cf_stream_uid: cfStreamUid,
    status,
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
