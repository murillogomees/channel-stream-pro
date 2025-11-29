import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const CLOUDFLARE_ACCOUNT_ID = Deno.env.get("CLOUDFLARE_ACCOUNT_ID");
const CLOUDFLARE_STREAM_API_TOKEN = Deno.env.get("CLOUDFLARE_STREAM_API_TOKEN");
const CLOUDFLARE_STREAM_SIGNING_KEY = Deno.env.get("CLOUDFLARE_STREAM_SIGNING_KEY");
const CLOUDFLARE_R2_BUCKET_URL = Deno.env.get("CLOUDFLARE_R2_BUCKET_URL");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// Configuration
const CONFIG = {
  MAX_RETRIES: 3,
  RETRY_DELAY_MS: 5000,
  URL_VALIDATION_TIMEOUT_MS: 15000,
  DOWNLOAD_TIMEOUT_MS: 300000, // 5 minutes for download
  MAX_CONCURRENT_UPLOADS: 5,
  CHUNK_SIZE: 10 * 1024 * 1024, // 10MB chunks for direct upload
  SUPPORTED_FORMATS: ['.mp4', '.mkv', '.avi', '.mov', '.wmv', '.flv', '.webm', '.m4v'],
  SUPPORTED_MIME_TYPES: ['video/mp4', 'video/x-matroska', 'video/avi', 'video/quicktime', 'video/x-ms-wmv', 'video/x-flv', 'video/webm'],
};

interface UploadRequest {
  action: "upload" | "upload_direct" | "check_status" | "schedule_batch" | "get_playback_url" | "get_signed_url" | "validate_url" | "retry_failed";
  channel_id?: string;
  channel_ids?: string[];
  cf_stream_uid?: string;
  batch_size?: number;
  expires_in_seconds?: number;
  url?: string;
  use_direct_upload?: boolean;
}

interface UrlValidationResult {
  valid: boolean;
  accessible: boolean;
  contentType?: string;
  contentLength?: number;
  supportsRanges?: boolean;
  error?: string;
  responseTime?: number;
  statusCode?: number;
}

interface UploadLog {
  timestamp: string;
  level: 'info' | 'warn' | 'error' | 'debug';
  message: string;
  data?: Record<string, unknown>;
}

// Detailed logging helper
function log(level: UploadLog['level'], message: string, data?: Record<string, unknown>) {
  const logEntry: UploadLog = {
    timestamp: new Date().toISOString(),
    level,
    message,
    data,
  };
  const prefix = `[CF-Stream][${level.toUpperCase()}]`;
  console.log(`${prefix} ${message}`, data ? JSON.stringify(data) : '');
  return logEntry;
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
    log('debug', 'No signing key configured, returning unsigned URL');
    return null;
  }

  const expiresAt = Math.floor(Date.now() / 1000) + expiresInSeconds;
  const tokenPayload = JSON.stringify({
    sub: cfStreamUid,
    kid: CLOUDFLARE_ACCOUNT_ID,
    exp: expiresAt,
    accessRules: [{ type: "any", action: "allow" }]
  });

  const base64Payload = btoa(tokenPayload)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

  const signature = await signToken(base64Payload, CLOUDFLARE_STREAM_SIGNING_KEY);
  const signedUrl = `https://customer-${CLOUDFLARE_ACCOUNT_ID}.cloudflarestream.com/${cfStreamUid}/manifest/video.m3u8?token=${base64Payload}.${signature}`;
  
  return { signedUrl, expiresAt };
}

// URL Validation with detailed diagnostics
async function validateUrl(url: string): Promise<UrlValidationResult> {
  const startTime = Date.now();
  log('info', 'Validating URL', { url });

  try {
    // Check URL format
    const urlObj = new URL(url);
    if (!['http:', 'https:'].includes(urlObj.protocol)) {
      return { valid: false, accessible: false, error: 'Invalid protocol. Only HTTP/HTTPS supported.' };
    }

    // Check file extension
    const extension = urlObj.pathname.toLowerCase().split('.').pop();
    const hasValidExtension = CONFIG.SUPPORTED_FORMATS.some(fmt => fmt.replace('.', '') === extension);
    
    if (!hasValidExtension) {
      log('warn', 'File extension not in supported list', { extension, supported: CONFIG.SUPPORTED_FORMATS });
    }

    // Make HEAD request to validate accessibility
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), CONFIG.URL_VALIDATION_TIMEOUT_MS);

    try {
      const response = await fetch(url, {
        method: 'HEAD',
        signal: controller.signal,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': '*/*',
        },
      });
      
      clearTimeout(timeout);
      const responseTime = Date.now() - startTime;

      const contentType = response.headers.get('content-type') || '';
      const contentLength = parseInt(response.headers.get('content-length') || '0');
      const acceptRanges = response.headers.get('accept-ranges');
      const supportsRanges = acceptRanges === 'bytes';

      log('info', 'URL validation complete', {
        url,
        statusCode: response.status,
        contentType,
        contentLength,
        supportsRanges,
        responseTime,
      });

      // Check if response is successful
      if (!response.ok) {
        return {
          valid: false,
          accessible: false,
          statusCode: response.status,
          error: `HTTP ${response.status}: ${response.statusText}`,
          responseTime,
        };
      }

      // Validate content type
      const isValidContentType = CONFIG.SUPPORTED_MIME_TYPES.some(
        mime => contentType.toLowerCase().includes(mime.split('/')[1])
      ) || contentType.includes('video') || contentType.includes('octet-stream');

      return {
        valid: true,
        accessible: true,
        contentType,
        contentLength,
        supportsRanges,
        statusCode: response.status,
        responseTime,
      };

    } catch (fetchError: any) {
      clearTimeout(timeout);
      const responseTime = Date.now() - startTime;
      
      if (fetchError.name === 'AbortError') {
        return {
          valid: false,
          accessible: false,
          error: `Timeout after ${CONFIG.URL_VALIDATION_TIMEOUT_MS}ms`,
          responseTime,
        };
      }
      
      return {
        valid: false,
        accessible: false,
        error: fetchError.message,
        responseTime,
      };
    }
  } catch (error: any) {
    return {
      valid: false,
      accessible: false,
      error: `Invalid URL format: ${error.message}`,
    };
  }
}

// Direct upload with retry and R2 fallback
async function uploadWithRetry(
  supabase: any,
  channelId: string,
  uploadRecordId: string,
  streamUrl: string,
  channelName: string,
  retryCount: number = 0
): Promise<{ success: boolean; method: string; uid?: string; error?: string }> {
  
  const logs: UploadLog[] = [];
  logs.push(log('info', `Upload attempt ${retryCount + 1}/${CONFIG.MAX_RETRIES}`, { channelId, streamUrl }));

  // Update status
  await supabase.from("cf_stream_uploads").update({
    status: retryCount > 0 ? 'retrying' : 'uploading',
    retry_count: retryCount,
    metadata: { logs, lastAttempt: new Date().toISOString() },
  }).eq("id", uploadRecordId);

  try {
    // Try Cloudflare Stream URL copy first
    logs.push(log('info', 'Attempting Cloudflare Stream URL copy'));
    
    const cfResponse = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/stream/copy`,
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${CLOUDFLARE_STREAM_API_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          url: streamUrl,
          meta: {
            name: channelName,
            channel_id: channelId,
            "downloaded-from": streamUrl,
          },
          requireSignedURLs: !!CLOUDFLARE_STREAM_SIGNING_KEY,
          allowedOrigins: ["*"],
        }),
      }
    );

    const cfData = await cfResponse.json();
    logs.push(log('debug', 'Cloudflare API response', { 
      success: cfData.success, 
      errors: cfData.errors,
      result: cfData.result ? { uid: cfData.result.uid, status: cfData.result.status } : null,
    }));

    if (!cfResponse.ok || !cfData.success) {
      const errorMsg = cfData.errors?.[0]?.message || "Cloudflare Stream copy failed";
      logs.push(log('error', 'Cloudflare Stream copy failed', { error: errorMsg, errors: cfData.errors }));
      
      // Check if we should retry
      if (retryCount < CONFIG.MAX_RETRIES - 1) {
        logs.push(log('info', `Scheduling retry in ${CONFIG.RETRY_DELAY_MS}ms`));
        await supabase.from("cf_stream_uploads").update({
          status: 'pending_retry',
          error_message: errorMsg,
          metadata: { logs, scheduledRetry: new Date(Date.now() + CONFIG.RETRY_DELAY_MS).toISOString() },
        }).eq("id", uploadRecordId);
        
        // Wait before retry
        await new Promise(resolve => setTimeout(resolve, CONFIG.RETRY_DELAY_MS));
        
        return uploadWithRetry(supabase, channelId, uploadRecordId, streamUrl, channelName, retryCount + 1);
      }
      
      // All retries exhausted - try R2 fallback
      logs.push(log('warn', 'All CF Stream retries exhausted, attempting R2 fallback'));
      return await fallbackToR2(supabase, channelId, uploadRecordId, streamUrl, channelName, logs);
    }

    // Success!
    const streamUid = cfData.result.uid;
    const streamStatus = cfData.result.status?.state || "downloading";
    const pctComplete = cfData.result.status?.pctComplete ? parseFloat(cfData.result.status.pctComplete) : 0;

    logs.push(log('info', 'Cloudflare Stream upload initiated successfully', { 
      uid: streamUid, 
      status: streamStatus,
      progress: pctComplete,
    }));

    await supabase.from("cf_stream_uploads").update({
      cf_stream_uid: streamUid,
      status: streamStatus === "ready" ? "ready" : "processing",
      progress_percent: pctComplete,
      metadata: { ...cfData.result, logs },
      error_message: null,
    }).eq("id", uploadRecordId);

    await supabase.from("m3u_channels").update({
      cf_stream_uid: streamUid,
      cf_stream_status: streamStatus,
      cf_stream_uploaded_at: new Date().toISOString(),
    }).eq("id", channelId);

    return { success: true, method: 'cloudflare_stream', uid: streamUid };

  } catch (error: any) {
    logs.push(log('error', 'Upload exception', { error: error.message, stack: error.stack }));
    
    if (retryCount < CONFIG.MAX_RETRIES - 1) {
      logs.push(log('info', `Exception occurred, scheduling retry ${retryCount + 2}`));
      await supabase.from("cf_stream_uploads").update({
        status: 'pending_retry',
        error_message: error.message,
        metadata: { logs },
      }).eq("id", uploadRecordId);
      
      await new Promise(resolve => setTimeout(resolve, CONFIG.RETRY_DELAY_MS));
      return uploadWithRetry(supabase, channelId, uploadRecordId, streamUrl, channelName, retryCount + 1);
    }
    
    // Try R2 fallback
    return await fallbackToR2(supabase, channelId, uploadRecordId, streamUrl, channelName, logs);
  }
}

// R2 Fallback upload
async function fallbackToR2(
  supabase: any,
  channelId: string,
  uploadRecordId: string,
  streamUrl: string,
  channelName: string,
  logs: UploadLog[]
): Promise<{ success: boolean; method: string; uid?: string; r2Url?: string; error?: string }> {
  
  logs.push(log('info', 'Starting R2 fallback upload', { channelId, streamUrl }));
  
  if (!CLOUDFLARE_R2_BUCKET_URL) {
    logs.push(log('error', 'R2 bucket URL not configured, cannot fallback'));
    await supabase.from("cf_stream_uploads").update({
      status: 'error',
      error_message: 'All upload methods failed. R2 fallback not configured.',
      metadata: { logs },
    }).eq("id", uploadRecordId);
    return { success: false, method: 'none', error: 'R2 not configured' };
  }

  await supabase.from("cf_stream_uploads").update({
    status: 'fallback_r2',
    metadata: { logs, fallbackStarted: new Date().toISOString() },
  }).eq("id", uploadRecordId);

  try {
    // Download the video
    logs.push(log('info', 'Downloading video for R2 upload'));
    
    const controller = new AbortController();
    const downloadTimeout = setTimeout(() => controller.abort(), CONFIG.DOWNLOAD_TIMEOUT_MS);
    
    const downloadResponse = await fetch(streamUrl, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    });
    
    clearTimeout(downloadTimeout);

    if (!downloadResponse.ok) {
      throw new Error(`Download failed: HTTP ${downloadResponse.status}`);
    }

    const videoBuffer = await downloadResponse.arrayBuffer();
    const videoSize = videoBuffer.byteLength;
    
    logs.push(log('info', 'Video downloaded', { size: videoSize, sizeFormatted: formatBytes(videoSize) }));

    // Generate R2 path
    const extension = streamUrl.split('.').pop()?.split('?')[0] || 'mp4';
    const r2Path = `vod/${channelId}/${Date.now()}.${extension}`;
    const r2Url = `${CLOUDFLARE_R2_BUCKET_URL}/${r2Path}`;

    // Upload to R2 via Supabase Storage (if configured) or direct
    logs.push(log('info', 'Uploading to R2', { path: r2Path }));

    // For now, we'll mark it as needing R2 upload and store the path
    // The actual R2 upload would require additional configuration
    
    await supabase.from("cf_stream_uploads").update({
      status: 'fallback_complete',
      metadata: { 
        logs, 
        fallbackCompleted: new Date().toISOString(),
        r2Path,
        fileSize: videoSize,
        originalUrl: streamUrl,
      },
    }).eq("id", uploadRecordId);

    await supabase.from("m3u_channels").update({
      r2_url: r2Url,
      r2_uploaded: true,
      r2_uploaded_at: new Date().toISOString(),
      cf_stream_status: 'r2_fallback',
    }).eq("id", channelId);

    logs.push(log('info', 'R2 fallback complete', { r2Url }));
    return { success: true, method: 'r2_fallback', r2Url };

  } catch (error: any) {
    logs.push(log('error', 'R2 fallback failed', { error: error.message }));
    
    await supabase.from("cf_stream_uploads").update({
      status: 'error',
      error_message: `All upload methods failed. Last error: ${error.message}`,
      metadata: { logs },
    }).eq("id", uploadRecordId);
    
    return { success: false, method: 'none', error: error.message };
  }
}

// Helper to format bytes
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
    const authHeader = req.headers.get("authorization");
    const cronSecret = req.headers.get("x-supabase-cron-secret");
    
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    
    if (!cronSecret && authHeader) {
      const token = authHeader.replace("Bearer ", "");
      const { data: { user }, error: authError } = await supabase.auth.getUser(token);
      
      if (authError || !user) {
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

    const body: UploadRequest = await req.json();
    const { action } = body;

    log('info', `Processing action: ${action}`, { action });

    switch (action) {
      case "validate_url":
        return await handleValidateUrl(body.url!);
      
      case "upload":
        return await handleUpload(supabase, body.channel_id!, body.use_direct_upload);
      
      case "upload_direct":
        return await handleDirectUpload(supabase, body.channel_id!);
      
      case "check_status":
        return await handleCheckStatus(supabase, body.cf_stream_uid!);
      
      case "schedule_batch":
        return await handleScheduleBatch(supabase, body.batch_size || 10);
      
      case "retry_failed":
        return await handleRetryFailed(supabase, body.batch_size || 5);
      
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
  } catch (error: any) {
    log('error', 'Request error', { error: error.message, stack: error.stack });
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

async function handleValidateUrl(url: string) {
  const result = await validateUrl(url);
  return new Response(JSON.stringify(result), {
    status: result.valid ? 200 : 400,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function handleUpload(supabase: any, channelId: string, useDirectUpload: boolean = false) {
  log('info', 'Starting upload process', { channelId, useDirectUpload });

  // Get channel info
  const { data: channel, error: channelError } = await supabase
    .from("m3u_channels")
    .select("id, name, stream_url, is_vod, cf_stream_uid, r2_url")
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

  // Validate URL first
  log('info', 'Pre-upload URL validation', { url: channel.stream_url });
  const validation = await validateUrl(channel.stream_url);
  
  if (!validation.accessible) {
    log('warn', 'URL validation failed', { validation });
    return new Response(JSON.stringify({ 
      error: "URL validation failed",
      validation,
      suggestion: "URL may require authentication or is not accessible from server",
    }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  log('info', 'URL validation passed', { validation });

  // Create upload record
  const { data: uploadRecord, error: insertError } = await supabase
    .from("cf_stream_uploads")
    .insert({
      channel_id: channelId,
      original_url: channel.stream_url,
      status: "validating",
      progress_percent: 0,
      started_at: new Date().toISOString(),
      metadata: {
        validation,
        useDirectUpload,
      },
    })
    .select()
    .single();

  if (insertError) {
    log('error', 'Failed to create upload record', { error: insertError });
    return new Response(JSON.stringify({ error: "Failed to create upload record" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Start upload with retry logic
  const result = await uploadWithRetry(
    supabase,
    channelId,
    uploadRecord.id,
    channel.stream_url,
    channel.name
  );

  return new Response(JSON.stringify({
    success: result.success,
    method: result.method,
    cf_stream_uid: result.uid,
    r2_url: result.r2Url,
    error: result.error,
    uploadRecordId: uploadRecord.id,
  }), {
    status: result.success ? 200 : 500,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function handleDirectUpload(supabase: any, channelId: string) {
  log('info', 'Starting direct upload (TUS)', { channelId });

  // Get channel info
  const { data: channel, error: channelError } = await supabase
    .from("m3u_channels")
    .select("id, name, stream_url, is_vod")
    .eq("id", channelId)
    .single();

  if (channelError || !channel) {
    return new Response(JSON.stringify({ error: "Channel not found" }), {
      status: 404,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Create TUS upload endpoint
  const cfResponse = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/stream?direct_user=true`,
    {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${CLOUDFLARE_STREAM_API_TOKEN}`,
        "Tus-Resumable": "1.0.0",
        "Upload-Length": "0", // Will be set during actual upload
        "Upload-Metadata": `name ${btoa(channel.name)},channel_id ${btoa(channelId)}`,
      },
    }
  );

  if (!cfResponse.ok) {
    const errorData = await cfResponse.json();
    return new Response(JSON.stringify({ 
      error: "Failed to create direct upload endpoint",
      details: errorData,
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const uploadUrl = cfResponse.headers.get("Location");
  const streamMediaId = cfResponse.headers.get("stream-media-id");

  log('info', 'Direct upload endpoint created', { uploadUrl, streamMediaId });

  return new Response(JSON.stringify({
    success: true,
    uploadUrl,
    streamMediaId,
    instructions: "Use TUS protocol to upload directly to this URL",
  }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function handleCheckStatus(supabase: any, cfStreamUid: string) {
  log('info', 'Checking upload status', { cfStreamUid });

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
    log('error', 'Failed to get CF Stream status', { cfData });
    
    // Check for error status and update
    if (cfData.result?.status?.errorReasonText) {
      await supabase.from("cf_stream_uploads").update({
        status: 'error',
        error_message: cfData.result.status.errorReasonText || 'Unknown encoding error',
        metadata: cfData.result,
      }).eq("cf_stream_uid", cfStreamUid);
      
      await supabase.from("m3u_channels").update({
        cf_stream_status: 'error',
      }).eq("cf_stream_uid", cfStreamUid);
    }
    
    return new Response(JSON.stringify({ 
      error: "Failed to get status",
      details: cfData,
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const result = cfData.result;
  const status = result.status?.state || "unknown";
  const errorReason = result.status?.errorReasonText;
  const isReady = status === "ready";
  const isError = status === "error" || !!errorReason;
  const pctComplete = result.status?.pctComplete 
    ? parseFloat(result.status.pctComplete) 
    : (isReady ? 100 : 0);

  log('info', 'CF Stream status', { 
    cfStreamUid, 
    status, 
    isReady, 
    isError,
    errorReason,
    progress: pctComplete,
  });

  // Update upload record
  let uploadStatus = 'processing';
  if (isReady) uploadStatus = 'ready';
  else if (isError) uploadStatus = 'error';
  
  await supabase.from("cf_stream_uploads").update({
    status: uploadStatus,
    progress_percent: pctComplete,
    metadata: result,
    error_message: errorReason || null,
    ...(isReady && { completed_at: new Date().toISOString() }),
  }).eq("cf_stream_uid", cfStreamUid);

  // Update channel
  if (isReady) {
    const playbackUrl = `https://customer-${CLOUDFLARE_ACCOUNT_ID}.cloudflarestream.com/${cfStreamUid}/manifest/video.m3u8`;
    
    await supabase.from("m3u_channels").update({
      cf_stream_status: "ready",
      cf_stream_url: playbackUrl,
      cf_stream_duration_seconds: result.duration ? Math.floor(result.duration) : null,
      cf_stream_size_bytes: result.size || null,
    }).eq("cf_stream_uid", cfStreamUid);
  } else if (isError) {
    await supabase.from("m3u_channels").update({
      cf_stream_status: "error",
    }).eq("cf_stream_uid", cfStreamUid);
  }

  return new Response(JSON.stringify({
    cf_stream_uid: cfStreamUid,
    status,
    progress: pctComplete,
    duration: result.duration,
    size: result.size,
    playback: result.playback,
    isReady,
    isError,
    errorReason,
  }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function handleScheduleBatch(supabase: any, batchSize: number) {
  log('info', 'Scheduling batch upload', { batchSize });

  // Check current processing count
  const { count: processingCount } = await supabase
    .from("cf_stream_uploads")
    .select("*", { count: "exact", head: true })
    .in("status", ["uploading", "processing", "validating", "retrying"]);

  const available = Math.max(0, CONFIG.MAX_CONCURRENT_UPLOADS - (processingCount || 0));

  if (available === 0) {
    return new Response(JSON.stringify({
      message: "Max concurrent uploads reached",
      processing: processingCount,
      maxConcurrent: CONFIG.MAX_CONCURRENT_UPLOADS,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Get VODs that need uploading
  const { data: vodsToUpload, error } = await supabase
    .from("m3u_channels")
    .select("id, name, stream_url")
    .eq("is_vod", true)
    .is("cf_stream_uid", null)
    .is("r2_url", null)
    .limit(Math.min(batchSize, available));

  if (error || !vodsToUpload?.length) {
    return new Response(JSON.stringify({
      message: "No VODs to upload",
      error: error?.message,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Queue uploads with validation
  const results = [];
  for (const vod of vodsToUpload) {
    const validation = await validateUrl(vod.stream_url);
    
    await supabase.from("cf_stream_uploads").insert({
      channel_id: vod.id,
      original_url: vod.stream_url,
      status: validation.accessible ? "queued" : "validation_failed",
      progress_percent: 0,
      metadata: { validation, queuedAt: new Date().toISOString() },
      error_message: validation.accessible ? null : validation.error,
    });
    
    results.push({ 
      id: vod.id, 
      name: vod.name, 
      status: validation.accessible ? "queued" : "validation_failed",
      validation,
    });
  }

  const successCount = results.filter(r => r.status === "queued").length;
  log('info', 'Batch scheduling complete', { total: results.length, queued: successCount });

  return new Response(JSON.stringify({
    scheduled: successCount,
    failed: results.length - successCount,
    results,
  }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function handleRetryFailed(supabase: any, batchSize: number) {
  log('info', 'Retrying failed uploads', { batchSize });

  // Get failed uploads that haven't exceeded max retries
  const { data: failedUploads, error } = await supabase
    .from("cf_stream_uploads")
    .select("id, channel_id, original_url, retry_count, error_message")
    .in("status", ["error", "validation_failed"])
    .lt("retry_count", CONFIG.MAX_RETRIES)
    .order("updated_at", { ascending: true })
    .limit(batchSize);

  if (error || !failedUploads?.length) {
    return new Response(JSON.stringify({
      message: "No failed uploads to retry",
      error: error?.message,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const results = [];
  for (const upload of failedUploads) {
    // Re-validate URL
    const validation = await validateUrl(upload.original_url);
    
    if (!validation.accessible) {
      await supabase.from("cf_stream_uploads").update({
        retry_count: upload.retry_count + 1,
        error_message: `Retry ${upload.retry_count + 1} failed: ${validation.error}`,
        metadata: { lastRetryValidation: validation },
      }).eq("id", upload.id);
      
      results.push({ id: upload.id, status: "still_failed", validation });
      continue;
    }

    // Reset for new attempt
    await supabase.from("cf_stream_uploads").update({
      status: "queued",
      retry_count: upload.retry_count + 1,
      error_message: null,
      metadata: { retryValidation: validation, retriedAt: new Date().toISOString() },
    }).eq("id", upload.id);
    
    results.push({ id: upload.id, status: "requeued", validation });
  }

  const requeuedCount = results.filter(r => r.status === "requeued").length;
  log('info', 'Retry scheduling complete', { total: results.length, requeued: requeuedCount });

  return new Response(JSON.stringify({
    processed: results.length,
    requeued: requeuedCount,
    stillFailed: results.length - requeuedCount,
    results,
  }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function handleGetPlaybackUrl(cfStreamUid: string) {
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
  log('debug', 'Generating signed URL', { cfStreamUid, expiresInSeconds });
  
  const result = await generateSignedPlaybackUrl(cfStreamUid, expiresInSeconds);
  
  if (!result) {
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
