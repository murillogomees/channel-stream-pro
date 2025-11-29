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

// Configuration
const CONFIG = {
  MAX_CONCURRENT_UPLOADS: 3,
  BATCH_SIZE: 10,
  DELAY_BETWEEN_UPLOADS_MS: 2000,
};

function log(level: string, message: string, data?: any) {
  console.log(`[CF-Scheduler][${level.toUpperCase()}] ${message}`, data ? JSON.stringify(data) : '');
}

// Upload to Cloudflare Stream using URL copy with enhanced headers
async function uploadToCloudflareStream(
  url: string,
  channelName: string,
  channelId: string
): Promise<{ success: boolean; uid?: string; error?: string }> {
  log('info', 'Uploading to CF Stream via URL copy', { channelId, url: url.substring(0, 50) + '...' });

  try {
    // Prepare the copy request with Xtream-compatible settings
    const copyPayload = {
      url: url,
      meta: {
        name: channelName,
        channel_id: channelId,
      },
      // These are download options Cloudflare will use
      requireSignedURLs: false,
      allowedOrigins: ["*"],
    };

    const response = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/stream/copy`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${CLOUDFLARE_STREAM_API_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(copyPayload),
      }
    );

    const data = await response.json();

    if (!response.ok || !data.success) {
      const errorMsg = data.errors?.[0]?.message || `HTTP ${response.status}`;
      log('error', 'CF copy failed', { error: errorMsg, errors: data.errors });
      return { success: false, error: errorMsg };
    }

    const uid = data.result?.uid;
    if (!uid) {
      return { success: false, error: 'No UID returned from CF' };
    }

    log('info', 'CF copy initiated', { uid });
    return { success: true, uid };

  } catch (error: any) {
    log('error', 'CF upload exception', { error: error.message });
    return { success: false, error: error.message };
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const cronSecret = req.headers.get("x-supabase-cron-secret");
    const authHeader = req.headers.get("authorization");
    
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    if (!cronSecret) {
      if (!authHeader) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const token = authHeader.replace("Bearer ", "");
      const { data: { user } } = await supabase.auth.getUser(token);
      
      if (!user) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

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

    log('info', 'Starting scheduler run');

    const result = {
      statusChecked: 0,
      statusUpdated: 0,
      newUploads: 0,
      newQueued: 0,
      resetStuck: 0,
      activeUploads: 0,
      errors: [] as string[],
    };

    // 1. Check status of processing uploads
    const { data: processingUploads } = await supabase
      .from("cf_stream_uploads")
      .select("id, cf_stream_uid, channel_id")
      .eq("status", "processing")
      .limit(50);

    result.statusChecked = processingUploads?.length || 0;

    for (const upload of processingUploads || []) {
      if (!upload.cf_stream_uid) continue;

      try {
        const cfResponse = await fetch(
          `https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/stream/${upload.cf_stream_uid}`,
          {
            headers: { "Authorization": `Bearer ${CLOUDFLARE_STREAM_API_TOKEN}` },
          }
        );

        const cfData = await cfResponse.json();
        if (cfData.success && cfData.result) {
          const res = cfData.result;
          const isReady = res.readyToStream || res.status?.state === "ready";
          const isError = res.status?.state === "error";

          if (isReady) {
            const playbackUrl = `https://customer-${CLOUDFLARE_ACCOUNT_ID}.cloudflarestream.com/${upload.cf_stream_uid}/manifest/video.m3u8`;

            await supabase.from("m3u_channels").update({
              cf_stream_status: "ready",
              cf_stream_url: playbackUrl,
              cf_stream_duration_seconds: res.duration ? Math.floor(res.duration) : null,
              cf_stream_size_bytes: res.size || null,
            }).eq("id", upload.channel_id);

            await supabase.from("cf_stream_uploads").update({
              status: "ready",
              completed_at: new Date().toISOString(),
              metadata: res,
            }).eq("id", upload.id);

            result.statusUpdated++;
            log('info', 'Upload ready', { uid: upload.cf_stream_uid });
          } else if (isError) {
            await supabase.from("cf_stream_uploads").update({
              status: "error",
              error_message: res.status?.errorReasonText || "Encoding failed",
            }).eq("id", upload.id);
            
            await supabase.from("m3u_channels").update({
              cf_stream_status: "error",
            }).eq("id", upload.channel_id);
          }
        }
      } catch (err: any) {
        log('error', 'Status check failed', { uid: upload.cf_stream_uid, error: err.message });
      }
    }

    // 2. Count active uploads
    const { count: activeCount } = await supabase
      .from("cf_stream_uploads")
      .select("*", { count: "exact", head: true })
      .in("status", ["uploading", "processing"]);

    result.activeUploads = activeCount || 0;
    const availableSlots = Math.max(0, CONFIG.MAX_CONCURRENT_UPLOADS - result.activeUploads);

    // 3. Process queued uploads - let CF Stream fetch directly from source
    if (availableSlots > 0) {
      const { data: queuedUploads } = await supabase
        .from("cf_stream_uploads")
        .select("id, channel_id, original_url")
        .eq("status", "queued")
        .order("created_at", { ascending: true })
        .limit(availableSlots);

      for (const upload of queuedUploads || []) {
        try {
          const { data: channel } = await supabase
            .from("m3u_channels")
            .select("name")
            .eq("id", upload.channel_id)
            .single();

          const channelName = channel?.name || upload.channel_id;

          // Mark as uploading
          await supabase.from("cf_stream_uploads").update({
            status: "uploading",
            started_at: new Date().toISOString(),
          }).eq("id", upload.id);

          // Use CF Stream's copy feature - CF fetches directly
          const uploadResult = await uploadToCloudflareStream(
            upload.original_url,
            channelName,
            upload.channel_id
          );

          if (uploadResult.success && uploadResult.uid) {
            await supabase.from("cf_stream_uploads").update({
              cf_stream_uid: uploadResult.uid,
              status: "processing",
              upload_type: "copy",
            }).eq("id", upload.id);

            await supabase.from("m3u_channels").update({
              cf_stream_uid: uploadResult.uid,
              cf_stream_status: "processing",
              cf_stream_uploaded_at: new Date().toISOString(),
            }).eq("id", upload.channel_id);

            result.newUploads++;
          } else {
            // Mark as error with retry capability
            const { data: current } = await supabase
              .from("cf_stream_uploads")
              .select("retry_count")
              .eq("id", upload.id)
              .single();

            const newRetryCount = (current?.retry_count || 0) + 1;

            await supabase.from("cf_stream_uploads").update({
              status: newRetryCount >= 3 ? "error" : "queued",
              error_message: uploadResult.error,
              retry_count: newRetryCount,
              started_at: null,
            }).eq("id", upload.id);

            result.errors.push(`Upload failed for ${upload.channel_id}: ${uploadResult.error}`);
          }

          // Small delay between uploads
          if ((queuedUploads || []).indexOf(upload) < (queuedUploads || []).length - 1) {
            await new Promise(resolve => setTimeout(resolve, CONFIG.DELAY_BETWEEN_UPLOADS_MS));
          }

        } catch (err: any) {
          log('error', 'Upload error', { uploadId: upload.id, error: err.message });
          await supabase.from("cf_stream_uploads").update({
            status: "error",
            error_message: err.message,
          }).eq("id", upload.id);
        }
      }
    }

    // 4. Queue new VODs
    const { count: queuedCount } = await supabase
      .from("cf_stream_uploads")
      .select("*", { count: "exact", head: true })
      .eq("status", "queued");

    if ((queuedCount || 0) < CONFIG.BATCH_SIZE) {
      const { data: vodsToQueue } = await supabase
        .from("m3u_channels")
        .select("id, stream_url")
        .eq("is_vod", true)
        .is("cf_stream_uid", null)
        .is("r2_url", null)
        .limit(CONFIG.BATCH_SIZE - (queuedCount || 0));

      for (const vod of vodsToQueue || []) {
        const { count: existingCount } = await supabase
          .from("cf_stream_uploads")
          .select("*", { count: "exact", head: true })
          .eq("channel_id", vod.id)
          .not("status", "in", '("error","validation_failed")');

        if (!existingCount) {
          await supabase.from("cf_stream_uploads").insert({
            channel_id: vod.id,
            original_url: vod.stream_url,
            status: "queued",
            upload_type: "copy",
          });
          result.newQueued++;
        }
      }
    }

    // 5. Reset stuck uploads
    const stuckTime = new Date(Date.now() - 30 * 60 * 1000).toISOString();
    const { count: resetCount } = await supabase
      .from("cf_stream_uploads")
      .update({ status: "queued", started_at: null })
      .eq("status", "uploading")
      .lt("started_at", stuckTime)
      .lt("retry_count", 3);

    result.resetStuck = resetCount || 0;

    log('info', 'Scheduler completed', result);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error: any) {
    log('error', 'Scheduler error', { error: error.message, stack: error.stack });
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
