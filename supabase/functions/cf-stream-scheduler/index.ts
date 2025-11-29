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

const MAX_CONCURRENT_UPLOADS = 5;
const BATCH_SIZE = 10;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify cron secret or admin auth
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

    console.log("[CF-Scheduler] Starting batch processing...");

    // 1. Check status of processing uploads
    const { data: processingUploads } = await supabase
      .from("cf_stream_uploads")
      .select("id, cf_stream_uid, channel_id")
      .eq("status", "processing")
      .limit(50);

    let statusUpdated = 0;
    for (const upload of processingUploads || []) {
      if (!upload.cf_stream_uid) continue;

      try {
        const cfResponse = await fetch(
          `https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/stream/${upload.cf_stream_uid}`,
          {
            headers: {
              "Authorization": `Bearer ${CLOUDFLARE_STREAM_API_TOKEN}`,
            },
          }
        );

        const cfData = await cfResponse.json();
        if (cfData.success && cfData.result) {
          const result = cfData.result;
          const isReady = result.readyToStream || result.status?.state === "ready";

          if (isReady) {
            const playbackUrl = `https://customer-${CLOUDFLARE_ACCOUNT_ID}.cloudflarestream.com/${upload.cf_stream_uid}/manifest/video.m3u8`;

            await supabase
              .from("m3u_channels")
              .update({
                cf_stream_status: "ready",
                cf_stream_url: playbackUrl,
                cf_stream_duration_seconds: result.duration ? Math.floor(result.duration) : null,
                cf_stream_size_bytes: result.size || null,
              })
              .eq("id", upload.channel_id);

            await supabase
              .from("cf_stream_uploads")
              .update({
                status: "ready",
                completed_at: new Date().toISOString(),
                metadata: result,
              })
              .eq("id", upload.id);

            statusUpdated++;
          } else if (result.status?.state === "error") {
            await supabase
              .from("cf_stream_uploads")
              .update({
                status: "error",
                error_message: result.status?.errorReasonText || "Unknown error",
              })
              .eq("id", upload.id);
          }
        }
      } catch (err) {
        console.error(`[CF-Scheduler] Error checking status for ${upload.cf_stream_uid}:`, err);
      }
    }

    // 2. Count active uploads
    const { count: activeCount } = await supabase
      .from("cf_stream_uploads")
      .select("*", { count: "exact", head: true })
      .in("status", ["uploading", "processing"]);

    const availableSlots = Math.max(0, MAX_CONCURRENT_UPLOADS - (activeCount || 0));

    // 3. Process queued uploads
    let newUploads = 0;
    if (availableSlots > 0) {
      const { data: queuedUploads } = await supabase
        .from("cf_stream_uploads")
        .select("id, channel_id, original_url")
        .eq("status", "queued")
        .order("created_at", { ascending: true })
        .limit(availableSlots);

      for (const upload of queuedUploads || []) {
        try {
          // Get channel info
          const { data: channel } = await supabase
            .from("m3u_channels")
            .select("name")
            .eq("id", upload.channel_id)
            .single();

          // Upload to Cloudflare
          const cfResponse = await fetch(
            `https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/stream/copy`,
            {
              method: "POST",
              headers: {
                "Authorization": `Bearer ${CLOUDFLARE_STREAM_API_TOKEN}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                url: upload.original_url,
                meta: {
                  name: channel?.name || upload.channel_id,
                  channel_id: upload.channel_id,
                },
                requireSignedURLs: false,
                allowedOrigins: ["*"],
              }),
            }
          );

          const cfData = await cfResponse.json();

          if (cfData.success && cfData.result?.uid) {
            const streamUid = cfData.result.uid;

            await supabase
              .from("cf_stream_uploads")
              .update({
                cf_stream_uid: streamUid,
                status: "processing",
                started_at: new Date().toISOString(),
                metadata: cfData.result,
              })
              .eq("id", upload.id);

            await supabase
              .from("m3u_channels")
              .update({
                cf_stream_uid: streamUid,
                cf_stream_status: "processing",
                cf_stream_uploaded_at: new Date().toISOString(),
              })
              .eq("id", upload.channel_id);

            newUploads++;
            console.log(`[CF-Scheduler] Started upload: ${streamUid}`);
          } else {
            const errorMsg = cfData.errors?.[0]?.message || "Upload failed";
            await supabase
              .from("cf_stream_uploads")
              .update({
                status: "error",
                error_message: errorMsg,
                retry_count: upload.retry_count + 1,
              })
              .eq("id", upload.id);
          }
        } catch (err) {
          console.error(`[CF-Scheduler] Error processing upload ${upload.id}:`, err);
        }
      }
    }

    // 4. Queue new VODs if we have room
    let newQueued = 0;
    const queuedCount = await supabase
      .from("cf_stream_uploads")
      .select("*", { count: "exact", head: true })
      .eq("status", "queued");

    if ((queuedCount?.count || 0) < BATCH_SIZE) {
      const { data: vodsToQueue } = await supabase
        .from("m3u_channels")
        .select("id, stream_url")
        .eq("is_vod", true)
        .is("cf_stream_uid", null)
        .limit(BATCH_SIZE - (queuedCount?.count || 0));

      for (const vod of vodsToQueue || []) {
        // Check if not already in queue
        const { count: existingCount } = await supabase
          .from("cf_stream_uploads")
          .select("*", { count: "exact", head: true })
          .eq("channel_id", vod.id)
          .neq("status", "error");

        if (!existingCount) {
          await supabase.from("cf_stream_uploads").insert({
            channel_id: vod.id,
            original_url: vod.stream_url,
            status: "queued",
          });
          newQueued++;
        }
      }
    }

    // 5. Reset stuck uploads
    const { count: resetCount } = await supabase
      .from("cf_stream_uploads")
      .update({ status: "queued", started_at: null })
      .eq("status", "uploading")
      .lt("started_at", new Date(Date.now() - 30 * 60 * 1000).toISOString())
      .lt("retry_count", 3);

    // 6. Clean up old completed uploads
    await supabase.rpc("cleanup_old_cf_stream_uploads");

    const result = {
      statusChecked: processingUploads?.length || 0,
      statusUpdated,
      newUploads,
      newQueued,
      resetStuck: resetCount || 0,
      activeUploads: activeCount || 0,
    };

    console.log("[CF-Scheduler] Completed:", result);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[CF-Scheduler] Error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
