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

// Configuration - reduced for rate limiting
const CONFIG = {
  MAX_CONCURRENT_UPLOADS: 2, // Reduced to avoid overloading origin server
  BATCH_SIZE: 5,
  DELAY_BETWEEN_UPLOADS_MS: 5000, // 5s between uploads to origin server
  XTREAM_USER_AGENT: 'VLC/3.0.20 LibVLC/3.0.20',
  DOWNLOAD_TIMEOUT_MS: 600000, // 10 minutes
};

function log(level: string, message: string, data?: any) {
  console.log(`[CF-Scheduler][${level.toUpperCase()}] ${message}`, data ? JSON.stringify(data) : '');
}

// Extract Xtream credentials from URL
function extractXtreamCredentials(url: string) {
  try {
    const match = url.match(/^(https?:\/\/[^\/]+)\/(series|movie)\/([^\/]+)\/([^\/]+)\/(.+)$/);
    if (match) {
      return { baseUrl: match[1], username: match[3], password: match[4] };
    }
    return null;
  } catch {
    return null;
  }
}

// Generate optimized headers for Xtream sources
function getOptimizedHeaders(url: string): Record<string, string> {
  const credentials = extractXtreamCredentials(url);
  
  const headers: Record<string, string> = {
    'User-Agent': CONFIG.XTREAM_USER_AGENT,
    'Accept': '*/*',
    'Accept-Encoding': 'identity',
    'Connection': 'keep-alive',
    'Cache-Control': 'no-cache',
  };

  if (credentials) {
    headers['Referer'] = credentials.baseUrl + '/';
    headers['Origin'] = credentials.baseUrl;
  }

  return headers;
}

// Download video with progress tracking
async function downloadVideo(url: string): Promise<ArrayBuffer | null> {
  log('info', 'Downloading video', { url });
  
  const headers = getOptimizedHeaders(url);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), CONFIG.DOWNLOAD_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      method: 'GET',
      signal: controller.signal,
      headers,
    });
    
    clearTimeout(timeout);

    if (!response.ok) {
      log('error', 'Download failed', { status: response.status });
      return null;
    }

    const buffer = await response.arrayBuffer();
    log('info', 'Download complete', { size: formatBytes(buffer.byteLength) });
    return buffer;

  } catch (error: any) {
    clearTimeout(timeout);
    log('error', 'Download exception', { error: error.message });
    return null;
  }
}

// Upload to Cloudflare Stream using TUS direct upload
async function uploadToCloudflareStream(
  videoBuffer: ArrayBuffer,
  channelName: string,
  channelId: string
): Promise<{ success: boolean; uid?: string; error?: string }> {
  log('info', 'Uploading to CF Stream (TUS)', { channelId, size: formatBytes(videoBuffer.byteLength) });

  try {
    // Step 1: Create TUS upload endpoint
    const createResponse = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/stream?direct_user=true`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${CLOUDFLARE_STREAM_API_TOKEN}`,
          'Tus-Resumable': '1.0.0',
          'Upload-Length': videoBuffer.byteLength.toString(),
          'Upload-Metadata': `name ${btoa(channelName)},channel_id ${btoa(channelId)}`,
        },
      }
    );

    if (!createResponse.ok) {
      const errorData = await createResponse.json();
      return { success: false, error: errorData.errors?.[0]?.message || 'Failed to create endpoint' };
    }

    const uploadUrl = createResponse.headers.get('Location');
    const streamMediaId = createResponse.headers.get('stream-media-id');
    
    if (!uploadUrl || !streamMediaId) {
      return { success: false, error: 'No upload URL returned' };
    }

    log('debug', 'Upload endpoint created', { streamMediaId });

    // Step 2: Upload the video using TUS PATCH
    const uploadResponse = await fetch(uploadUrl, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/offset+octet-stream',
        'Upload-Offset': '0',
        'Tus-Resumable': '1.0.0',
      },
      body: videoBuffer,
    });

    if (!uploadResponse.ok) {
      return { success: false, error: `Upload failed: ${uploadResponse.status}` };
    }

    log('info', 'TUS upload complete', { uid: streamMediaId });
    return { success: true, uid: streamMediaId };

  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
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

    log('info', 'Starting batch processing with PROXY method');

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
            }).eq("cf_stream_uid", upload.cf_stream_uid);
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
      .in("status", ["uploading", "downloading", "processing"]);

    result.activeUploads = activeCount || 0;
    const availableSlots = Math.max(0, CONFIG.MAX_CONCURRENT_UPLOADS - result.activeUploads);

    // 3. Process queued uploads using PROXY method (download → direct upload)
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

          const channelName = channel?.name || upload.channel_id;

          // Mark as downloading
          await supabase.from("cf_stream_uploads").update({
            status: "downloading",
            started_at: new Date().toISOString(),
          }).eq("id", upload.id);

          // Download video via our proxy
          const videoBuffer = await downloadVideo(upload.original_url);
          
          if (!videoBuffer) {
            await supabase.from("cf_stream_uploads").update({
              status: "error",
              error_message: "Download failed - source may be rate limiting",
              retry_count: supabase.sql`retry_count + 1`,
            }).eq("id", upload.id);
            result.errors.push(`Download failed for ${upload.channel_id}`);
            continue;
          }

          // Mark as uploading
          await supabase.from("cf_stream_uploads").update({
            status: "uploading",
            metadata: { downloadedSize: videoBuffer.byteLength },
          }).eq("id", upload.id);

          // Upload to CF Stream using TUS
          const uploadResult = await uploadToCloudflareStream(videoBuffer, channelName, upload.channel_id);

          if (uploadResult.success && uploadResult.uid) {
            await supabase.from("cf_stream_uploads").update({
              cf_stream_uid: uploadResult.uid,
              status: "processing",
              metadata: { uploadedAt: new Date().toISOString(), size: videoBuffer.byteLength },
            }).eq("id", upload.id);

            await supabase.from("m3u_channels").update({
              cf_stream_uid: uploadResult.uid,
              cf_stream_status: "processing",
              cf_stream_uploaded_at: new Date().toISOString(),
              cf_stream_size_bytes: videoBuffer.byteLength,
            }).eq("id", upload.channel_id);

            result.newUploads++;
            log('info', 'Proxy upload complete', { uid: uploadResult.uid, channelId: upload.channel_id });
          } else {
            await supabase.from("cf_stream_uploads").update({
              status: "error",
              error_message: uploadResult.error || "Upload to CF Stream failed",
            }).eq("id", upload.id);
            result.errors.push(`CF upload failed for ${upload.channel_id}: ${uploadResult.error}`);
          }

          // Add delay between uploads to avoid rate limiting on origin server
          if ((queuedUploads || []).indexOf(upload) < (queuedUploads || []).length - 1) {
            log('debug', `Waiting ${CONFIG.DELAY_BETWEEN_UPLOADS_MS}ms before next upload`);
            await new Promise(resolve => setTimeout(resolve, CONFIG.DELAY_BETWEEN_UPLOADS_MS));
          }

        } catch (err: any) {
          log('error', 'Upload processing error', { uploadId: upload.id, error: err.message });
          await supabase.from("cf_stream_uploads").update({
            status: "error",
            error_message: err.message,
          }).eq("id", upload.id);
        }
      }
    }

    // 4. Queue new VODs if we have room
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
            upload_type: "proxy",
          });
          result.newQueued++;
        }
      }
    }

    // 5. Reset stuck uploads (downloading/uploading for > 30min)
    const stuckTime = new Date(Date.now() - 30 * 60 * 1000).toISOString();
    const { count: resetCount } = await supabase
      .from("cf_stream_uploads")
      .update({ status: "queued", started_at: null })
      .in("status", ["uploading", "downloading"])
      .lt("started_at", stuckTime)
      .lt("retry_count", 3);

    result.resetStuck = resetCount || 0;

    log('info', 'Scheduler completed', result);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error: any) {
    log('error', 'Scheduler error', { error: error.message });
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
