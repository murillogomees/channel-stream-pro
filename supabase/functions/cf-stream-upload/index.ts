import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const CLOUDFLARE_ACCOUNT_ID = Deno.env.get("CLOUDFLARE_ACCOUNT_ID");
const CLOUDFLARE_STREAM_API_TOKEN = Deno.env.get("CLOUDFLARE_STREAM_API_TOKEN");
const CLOUDFLARE_STREAM_SIGNING_KEY = Deno.env.get("CLOUDFLARE_STREAM_SIGNING_KEY");
const R2_ACCESS_KEY_ID = Deno.env.get("R2_ACCESS_KEY_ID");
const R2_SECRET_ACCESS_KEY = Deno.env.get("R2_SECRET_ACCESS_KEY");
const R2_BUCKET_NAME = Deno.env.get("R2_BUCKET_NAME");
const R2_PUBLIC_DOMAIN = Deno.env.get("R2_PUBLIC_DOMAIN");
const R2_ACCOUNT_ID = Deno.env.get("R2_ACCOUNT_ID");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// Configuration
const CONFIG = {
  MAX_RETRIES: 3,
  RETRY_DELAY_MS: 5000,
  URL_VALIDATION_TIMEOUT_MS: 30000,
  DOWNLOAD_TIMEOUT_MS: 600000, // 10 minutes for download
  MAX_CONCURRENT_UPLOADS: 3,
  CHUNK_SIZE: 10 * 1024 * 1024, // 10MB chunks
  SUPPORTED_FORMATS: ['.mp4', '.mkv', '.avi', '.mov', '.wmv', '.flv', '.webm', '.m4v'],
  SUPPORTED_MIME_TYPES: ['video/mp4', 'video/x-matroska', 'video/avi', 'video/quicktime', 'video/x-ms-wmv', 'video/x-flv', 'video/webm'],
  // Rate limiting for source servers
  DELAY_BETWEEN_DOWNLOADS_MS: 3000, // 3s between downloads to avoid rate limiting
  MAX_FILE_SIZE_MB: 5000, // 5GB max
  // Xtream Codes compatible headers
  XTREAM_USER_AGENT: 'VLC/3.0.20 LibVLC/3.0.20',
};

interface UploadRequest {
  action: "upload" | "upload_proxy" | "upload_direct" | "check_status" | "schedule_batch" | "get_playback_url" | "get_signed_url" | "validate_url" | "retry_failed" | "configure_source";
  channel_id?: string;
  channel_ids?: string[];
  cf_stream_uid?: string;
  batch_size?: number;
  expires_in_seconds?: number;
  url?: string;
  use_direct_upload?: boolean;
  source_config?: SourceConfig;
}

interface SourceConfig {
  base_url?: string;
  username?: string;
  password?: string;
  custom_headers?: Record<string, string>;
  rate_limit_delay_ms?: number;
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
  headers?: Record<string, string>;
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

// Extract Xtream credentials from URL
function extractXtreamCredentials(url: string): { baseUrl: string; username: string; password: string } | null {
  try {
    // Pattern: http://server:port/series/username/password/videoid.mp4
    // Or: http://server:port/movie/username/password/videoid.mp4
    const match = url.match(/^(https?:\/\/[^\/]+)\/(series|movie)\/([^\/]+)\/([^\/]+)\/(.+)$/);
    if (match) {
      return {
        baseUrl: match[1],
        username: match[3],
        password: match[4],
      };
    }
    return null;
  } catch {
    return null;
  }
}

// Generate optimized headers for Xtream sources
function getOptimizedHeaders(url: string, customHeaders?: Record<string, string>): Record<string, string> {
  const credentials = extractXtreamCredentials(url);
  
  const headers: Record<string, string> = {
    'User-Agent': CONFIG.XTREAM_USER_AGENT,
    'Accept': '*/*',
    'Accept-Language': 'en-US,en;q=0.9',
    'Accept-Encoding': 'identity', // Don't compress - we need the raw video
    'Connection': 'keep-alive',
    'Cache-Control': 'no-cache',
    'Pragma': 'no-cache',
  };

  // Add referer matching the base URL
  if (credentials) {
    headers['Referer'] = credentials.baseUrl + '/';
    headers['Origin'] = credentials.baseUrl;
    log('debug', 'Detected Xtream source', { baseUrl: credentials.baseUrl, username: credentials.username });
  }

  // Apply custom headers
  if (customHeaders) {
    Object.assign(headers, customHeaders);
  }

  return headers;
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

// URL Validation with Xtream-optimized headers
async function validateUrl(url: string, customHeaders?: Record<string, string>): Promise<UrlValidationResult> {
  const startTime = Date.now();
  log('info', 'Validating URL with optimized headers', { url });

  try {
    const urlObj = new URL(url);
    if (!['http:', 'https:'].includes(urlObj.protocol)) {
      return { valid: false, accessible: false, error: 'Invalid protocol. Only HTTP/HTTPS supported.' };
    }

    const headers = getOptimizedHeaders(url, customHeaders);
    log('debug', 'Using headers for validation', { headers });

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), CONFIG.URL_VALIDATION_TIMEOUT_MS);

    try {
      // Try HEAD first
      let response = await fetch(url, {
        method: 'HEAD',
        signal: controller.signal,
        headers,
      });

      // Some servers don't support HEAD, try GET with Range
      if (!response.ok && response.status === 405) {
        log('debug', 'HEAD not supported, trying GET with Range');
        response = await fetch(url, {
          method: 'GET',
          signal: controller.signal,
          headers: { ...headers, 'Range': 'bytes=0-1023' },
        });
      }
      
      clearTimeout(timeout);
      const responseTime = Date.now() - startTime;

      const responseHeaders: Record<string, string> = {};
      response.headers.forEach((value, key) => {
        responseHeaders[key] = value;
      });

      const contentType = response.headers.get('content-type') || '';
      const contentLength = parseInt(response.headers.get('content-length') || '0');
      const acceptRanges = response.headers.get('accept-ranges');
      const supportsRanges = acceptRanges === 'bytes' || response.status === 206;

      log('info', 'URL validation complete', {
        url,
        statusCode: response.status,
        contentType,
        contentLength,
        supportsRanges,
        responseTime,
      });

      if (!response.ok && response.status !== 206) {
        return {
          valid: false,
          accessible: false,
          statusCode: response.status,
          error: `HTTP ${response.status}: ${response.statusText}`,
          responseTime,
          headers: responseHeaders,
        };
      }

      return {
        valid: true,
        accessible: true,
        contentType,
        contentLength,
        supportsRanges,
        statusCode: response.status,
        responseTime,
        headers: responseHeaders,
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

// Download video with optimized headers and progress tracking
async function downloadVideo(
  url: string, 
  onProgress?: (downloaded: number, total: number) => void
): Promise<{ buffer: ArrayBuffer; size: number; contentType: string } | null> {
  log('info', 'Starting video download via proxy', { url });
  
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
      log('error', 'Download failed', { status: response.status, statusText: response.statusText });
      return null;
    }

    const contentType = response.headers.get('content-type') || 'video/mp4';
    const contentLength = parseInt(response.headers.get('content-length') || '0');
    
    log('info', 'Download started', { contentType, contentLength: formatBytes(contentLength) });

    // Check file size limit
    if (contentLength > CONFIG.MAX_FILE_SIZE_MB * 1024 * 1024) {
      log('error', 'File too large', { size: contentLength, maxSize: CONFIG.MAX_FILE_SIZE_MB * 1024 * 1024 });
      return null;
    }

    // Stream download with progress
    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error('No response body');
    }

    const chunks: Uint8Array[] = [];
    let downloadedBytes = 0;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      
      chunks.push(value);
      downloadedBytes += value.length;
      
      if (onProgress && contentLength > 0) {
        onProgress(downloadedBytes, contentLength);
      }
    }

    // Combine chunks
    const totalLength = chunks.reduce((acc, chunk) => acc + chunk.length, 0);
    const buffer = new Uint8Array(totalLength);
    let offset = 0;
    for (const chunk of chunks) {
      buffer.set(chunk, offset);
      offset += chunk.length;
    }

    log('info', 'Download complete', { size: formatBytes(totalLength) });
    return { buffer: buffer.buffer, size: totalLength, contentType };

  } catch (error: any) {
    clearTimeout(timeout);
    log('error', 'Download exception', { error: error.message });
    return null;
  }
}

// Upload to Cloudflare Stream using direct upload (TUS)
async function uploadToCloudflareStreamDirect(
  videoBuffer: ArrayBuffer,
  channelName: string,
  channelId: string,
  contentType: string
): Promise<{ success: boolean; uid?: string; error?: string }> {
  log('info', 'Starting direct upload to Cloudflare Stream', { 
    channelId, 
    size: formatBytes(videoBuffer.byteLength) 
  });

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
          'Upload-Metadata': `name ${btoa(channelName)},channel_id ${btoa(channelId)},maxDurationSeconds ${btoa('21600')}`,
        },
      }
    );

    if (!createResponse.ok) {
      const errorData = await createResponse.json();
      log('error', 'Failed to create upload endpoint', { errorData });
      return { success: false, error: errorData.errors?.[0]?.message || 'Failed to create upload endpoint' };
    }

    const uploadUrl = createResponse.headers.get('Location');
    const streamMediaId = createResponse.headers.get('stream-media-id');
    
    if (!uploadUrl || !streamMediaId) {
      return { success: false, error: 'No upload URL returned' };
    }

    log('info', 'Upload endpoint created', { uploadUrl, streamMediaId });

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
      log('error', 'Upload failed', { status: uploadResponse.status });
      return { success: false, error: `Upload failed: ${uploadResponse.status}` };
    }

    log('info', 'Direct upload complete', { uid: streamMediaId });
    return { success: true, uid: streamMediaId };

  } catch (error: any) {
    log('error', 'Direct upload exception', { error: error.message });
    return { success: false, error: error.message };
  }
}

// Upload to R2 as fallback
async function uploadToR2(
  videoBuffer: ArrayBuffer,
  channelId: string,
  contentType: string
): Promise<{ success: boolean; url?: string; error?: string }> {
  if (!R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY || !R2_BUCKET_NAME || !R2_ACCOUNT_ID) {
    return { success: false, error: 'R2 not configured' };
  }

  log('info', 'Starting R2 fallback upload', { channelId, size: formatBytes(videoBuffer.byteLength) });

  try {
    const extension = contentType.includes('mp4') ? 'mp4' : 'video';
    const key = `vod/${channelId}/${Date.now()}.${extension}`;
    
    // R2 API endpoint
    const r2Endpoint = `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com/${R2_BUCKET_NAME}/${key}`;
    
    // Create AWS4 signature for R2
    const date = new Date().toISOString().replace(/[:-]|\.\d{3}/g, '');
    const dateStamp = date.substring(0, 8);
    
    const response = await fetch(r2Endpoint, {
      method: 'PUT',
      headers: {
        'Content-Type': contentType,
        'Content-Length': videoBuffer.byteLength.toString(),
        'x-amz-date': date,
        'x-amz-content-sha256': 'UNSIGNED-PAYLOAD',
        // Note: Full AWS4 signature would be needed for production
        // For now, using R2 API token which some configs support
      },
      body: videoBuffer,
    });

    if (!response.ok) {
      log('error', 'R2 upload failed', { status: response.status });
      return { success: false, error: `R2 upload failed: ${response.status}` };
    }

    const publicUrl = R2_PUBLIC_DOMAIN 
      ? `https://${R2_PUBLIC_DOMAIN}/${key}`
      : `https://${R2_BUCKET_NAME}.${R2_ACCOUNT_ID}.r2.cloudflarestorage.com/${key}`;

    log('info', 'R2 upload complete', { url: publicUrl });
    return { success: true, url: publicUrl };

  } catch (error: any) {
    log('error', 'R2 upload exception', { error: error.message });
    return { success: false, error: error.message };
  }
}

// Main proxy upload handler - downloads via our server, then uploads directly
async function handleProxyUpload(
  supabase: any,
  channelId: string
): Promise<Response> {
  const logs: UploadLog[] = [];
  logs.push(log('info', 'Starting PROXY upload (download→direct upload)', { channelId }));

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
      error: "Channel already uploaded",
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
      status: "downloading",
      upload_type: "proxy",
      progress_percent: 0,
      started_at: new Date().toISOString(),
      metadata: { logs, method: 'proxy_upload' },
    })
    .select()
    .single();

  if (insertError) {
    return new Response(JSON.stringify({ error: "Failed to create upload record" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    // Step 1: Validate URL
    logs.push(log('info', 'Validating source URL'));
    const validation = await validateUrl(channel.stream_url);
    
    if (!validation.accessible) {
      logs.push(log('error', 'URL validation failed', { validation }));
      await supabase.from("cf_stream_uploads").update({
        status: 'error',
        error_message: `URL validation failed: ${validation.error}`,
        metadata: { logs, validation },
      }).eq("id", uploadRecord.id);
      
      return new Response(JSON.stringify({ 
        error: "URL not accessible",
        validation,
      }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    logs.push(log('info', 'URL validation passed', { validation }));

    // Step 2: Download video via our proxy
    logs.push(log('info', 'Downloading video via proxy'));
    await supabase.from("cf_stream_uploads").update({
      status: 'downloading',
      metadata: { logs, downloadStarted: new Date().toISOString() },
    }).eq("id", uploadRecord.id);

    const downloadResult = await downloadVideo(channel.stream_url, async (downloaded, total) => {
      const progress = Math.round((downloaded / total) * 50); // 0-50% for download
      await supabase.from("cf_stream_uploads").update({
        progress_percent: progress,
        metadata: { 
          logs, 
          downloadProgress: { downloaded, total, percent: progress * 2 } 
        },
      }).eq("id", uploadRecord.id);
    });

    if (!downloadResult) {
      logs.push(log('error', 'Download failed'));
      await supabase.from("cf_stream_uploads").update({
        status: 'error',
        error_message: 'Failed to download video',
        metadata: { logs },
      }).eq("id", uploadRecord.id);
      
      return new Response(JSON.stringify({ error: "Download failed" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    logs.push(log('info', 'Download complete', { size: formatBytes(downloadResult.size) }));

    // Step 3: Upload to Cloudflare Stream directly
    logs.push(log('info', 'Uploading to Cloudflare Stream (direct)'));
    await supabase.from("cf_stream_uploads").update({
      status: 'uploading',
      progress_percent: 50,
      metadata: { logs, uploadStarted: new Date().toISOString() },
    }).eq("id", uploadRecord.id);

    const uploadResult = await uploadToCloudflareStreamDirect(
      downloadResult.buffer,
      channel.name,
      channelId,
      downloadResult.contentType
    );

    if (uploadResult.success && uploadResult.uid) {
      logs.push(log('info', 'Upload successful', { uid: uploadResult.uid }));
      
      await supabase.from("cf_stream_uploads").update({
        cf_stream_uid: uploadResult.uid,
        status: 'processing',
        progress_percent: 100,
        metadata: { logs, uploadCompleted: new Date().toISOString() },
      }).eq("id", uploadRecord.id);

      await supabase.from("m3u_channels").update({
        cf_stream_uid: uploadResult.uid,
        cf_stream_status: 'processing',
        cf_stream_uploaded_at: new Date().toISOString(),
        cf_stream_size_bytes: downloadResult.size,
      }).eq("id", channelId);

      return new Response(JSON.stringify({
        success: true,
        method: 'proxy_direct',
        cf_stream_uid: uploadResult.uid,
        uploadRecordId: uploadRecord.id,
        size: downloadResult.size,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Step 4: Fallback to R2
    logs.push(log('warn', 'CF Stream upload failed, trying R2 fallback', { error: uploadResult.error }));
    await supabase.from("cf_stream_uploads").update({
      status: 'fallback_r2',
      metadata: { logs, cfError: uploadResult.error },
    }).eq("id", uploadRecord.id);

    const r2Result = await uploadToR2(downloadResult.buffer, channelId, downloadResult.contentType);

    if (r2Result.success && r2Result.url) {
      logs.push(log('info', 'R2 fallback successful', { url: r2Result.url }));
      
      await supabase.from("cf_stream_uploads").update({
        status: 'r2_complete',
        progress_percent: 100,
        metadata: { logs, r2Url: r2Result.url },
      }).eq("id", uploadRecord.id);

      await supabase.from("m3u_channels").update({
        r2_url: r2Result.url,
        r2_uploaded: true,
        r2_uploaded_at: new Date().toISOString(),
        cf_stream_status: 'r2_fallback',
      }).eq("id", channelId);

      return new Response(JSON.stringify({
        success: true,
        method: 'r2_fallback',
        r2_url: r2Result.url,
        uploadRecordId: uploadRecord.id,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // All methods failed
    logs.push(log('error', 'All upload methods failed'));
    await supabase.from("cf_stream_uploads").update({
      status: 'error',
      error_message: `All methods failed. CF: ${uploadResult.error}, R2: ${r2Result.error}`,
      metadata: { logs },
    }).eq("id", uploadRecord.id);

    return new Response(JSON.stringify({
      success: false,
      error: 'All upload methods failed',
      cfError: uploadResult.error,
      r2Error: r2Result.error,
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error: any) {
    logs.push(log('error', 'Proxy upload exception', { error: error.message }));
    
    await supabase.from("cf_stream_uploads").update({
      status: 'error',
      error_message: error.message,
      metadata: { logs },
    }).eq("id", uploadRecord.id);

    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
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
        // Default upload now uses proxy method
        return await handleProxyUpload(supabase, body.channel_id!);
      
      case "upload_proxy":
        return await handleProxyUpload(supabase, body.channel_id!);
      
      case "upload_direct":
        return await handleDirectUpload(supabase, body.channel_id!);
      
      case "check_status":
        return await handleCheckStatus(supabase, body.cf_stream_uid!);
      
      case "schedule_batch":
        return await handleScheduleBatch(supabase, body.batch_size || 5);
      
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

async function handleDirectUpload(supabase: any, channelId: string) {
  log('info', 'Creating direct upload endpoint (TUS)', { channelId });

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

  const cfResponse = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/stream?direct_user=true`,
    {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${CLOUDFLARE_STREAM_API_TOKEN}`,
        "Tus-Resumable": "1.0.0",
        "Upload-Length": "0",
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
  log('info', 'Scheduling batch upload with proxy method', { batchSize });

  // Check current processing count
  const { count: processingCount } = await supabase
    .from("cf_stream_uploads")
    .select("*", { count: "exact", head: true })
    .in("status", ["uploading", "downloading", "processing", "validating"]);

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

  // Queue uploads with delay between validations
  const results = [];
  for (const vod of vodsToUpload) {
    const validation = await validateUrl(vod.stream_url);
    
    await supabase.from("cf_stream_uploads").insert({
      channel_id: vod.id,
      original_url: vod.stream_url,
      status: validation.accessible ? "queued" : "validation_failed",
      upload_type: "proxy",
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

    // Add delay between URL checks to avoid rate limiting
    if (vodsToUpload.indexOf(vod) < vodsToUpload.length - 1) {
      await new Promise(resolve => setTimeout(resolve, CONFIG.DELAY_BETWEEN_DOWNLOADS_MS));
    }
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
    const validation = await validateUrl(upload.original_url);
    
    if (!validation.accessible) {
      await supabase.from("cf_stream_uploads").update({
        retry_count: (upload.retry_count || 0) + 1,
        error_message: `Retry ${(upload.retry_count || 0) + 1} failed: ${validation.error}`,
        metadata: { lastRetryValidation: validation },
      }).eq("id", upload.id);
      
      results.push({ id: upload.id, status: "still_failed", validation });
      continue;
    }

    await supabase.from("cf_stream_uploads").update({
      status: "queued",
      retry_count: (upload.retry_count || 0) + 1,
      error_message: null,
      metadata: { retryValidation: validation, retriedAt: new Date().toISOString() },
    }).eq("id", upload.id);
    
    results.push({ id: upload.id, status: "requeued", validation });

    // Delay between retries
    await new Promise(resolve => setTimeout(resolve, CONFIG.DELAY_BETWEEN_DOWNLOADS_MS));
  }

  const requeuedCount = results.filter(r => r.status === "requeued").length;

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
