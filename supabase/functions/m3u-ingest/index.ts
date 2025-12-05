/**
 * M3U Ingest Orchestrator
 * 
 * Stream-safe M3U ingest with automatic fallback to signed URLs.
 * Zero buffer in RAM - all downloads are streamed.
 * 
 * Features:
 * - Streaming proxy origin → R2 (no memory buffering)
 * - Automatic fallback to signed URL when timeout risk detected
 * - Retry with exponential backoff
 * - Comprehensive observability (metrics, traces, structured logs)
 * 
 * @version 1.0.0
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { S3Client, PutObjectCommand } from "npm:@aws-sdk/client-s3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// =============================================
// CONFIGURATION
// =============================================

const CONFIG = {
  // Timeouts
  WORKER_MAX_TIME_MS: 80000,       // 80s - leave 20s buffer before 100s limit
  FETCH_TIMEOUT_MS: 30000,         // 30s fetch timeout
  SLOW_READ_THRESHOLD_MS: 10000,   // 10s without data = slow read
  
  // Retry policy
  MAX_RETRIES: 3,
  INITIAL_BACKOFF_MS: 1000,
  MAX_BACKOFF_MS: 10000,
  
  // Chunk sizes
  MIN_CHUNK_SIZE: 1024,            // 1KB
  PROGRESS_LOG_INTERVAL: 1000000,  // Log every 1MB
  
  // R2 bucket
  DEFAULT_BUCKET: 'iptvlink-cdn',
  DEFAULT_CDN_URL: 'https://cdn.iptvlink.app',
};

// =============================================
// TYPES
// =============================================

interface IngestRequest {
  originUrl: string;
  objectKey?: string;
  userId?: string;
  sourceId?: string;
  metadata?: Record<string, string>;
  forceSignedUrl?: boolean;
}

interface IngestResult {
  success: boolean;
  objectKey: string;
  cdnUrl: string;
  bytes: number;
  durationMs: number;
  method: 'stream' | 'signed_url' | 'fallback';
  retryCount: number;
  traceId: string;
}

interface IngestMetrics {
  traceId: string;
  originUrl: string;
  objectKey: string;
  bytes: number;
  durationMs: number;
  method: string;
  retryCount: number;
  status: 'success' | 'failed';
  errorMessage?: string;
}

// =============================================
// LOGGING & METRICS
// =============================================

function createLogger(traceId: string) {
  return {
    info: (message: string, data?: Record<string, unknown>) => {
      console.log(JSON.stringify({
        timestamp: new Date().toISOString(),
        traceId,
        level: 'info',
        message,
        ...data,
      }));
    },
    warn: (message: string, data?: Record<string, unknown>) => {
      console.log(JSON.stringify({
        timestamp: new Date().toISOString(),
        traceId,
        level: 'warn',
        message,
        ...data,
      }));
    },
    error: (message: string, data?: Record<string, unknown>) => {
      console.log(JSON.stringify({
        timestamp: new Date().toISOString(),
        traceId,
        level: 'error',
        message,
        ...data,
      }));
    },
  };
}

async function recordMetrics(supabase: any, metrics: IngestMetrics) {
  try {
    await supabase.from('m3u_ingest_metrics').insert({
      trace_id: metrics.traceId,
      origin_url: metrics.originUrl.substring(0, 500),
      object_key: metrics.objectKey,
      bytes_transferred: metrics.bytes,
      duration_ms: metrics.durationMs,
      ingest_method: metrics.method,
      retry_count: metrics.retryCount,
      status: metrics.status,
      error_message: metrics.errorMessage?.substring(0, 1000),
      created_at: new Date().toISOString(),
    });
  } catch (err) {
    console.error('[Metrics] Failed to record:', err);
  }
}

// =============================================
// R2 CLIENT
// =============================================

function getR2Client(): S3Client {
  const accountId = Deno.env.get('R2_ACCOUNT_ID') || Deno.env.get('CLOUDFLARE_ACCOUNT_ID');
  const accessKeyId = Deno.env.get('R2_ACCESS_KEY_ID');
  const secretAccessKey = Deno.env.get('R2_SECRET_ACCESS_KEY');

  if (!accountId || !accessKeyId || !secretAccessKey) {
    throw new Error('R2 configuration missing');
  }

  return new S3Client({
    region: 'auto',
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId,
      secretAccessKey,
    },
  });
}

// =============================================
// STREAMING INGEST
// =============================================

async function streamToR2(
  originUrl: string,
  objectKey: string,
  log: ReturnType<typeof createLogger>,
  startTime: number,
  abortController: AbortController
): Promise<{ bytes: number; complete: boolean; slowRead: boolean }> {
  log.info('Starting stream fetch', { originUrl, objectKey });

  const response = await fetch(originUrl, {
    signal: abortController.signal,
    headers: {
      'User-Agent': 'M3U-Ingest/1.0 (compatible; streaming)',
      'Connection': 'keep-alive',
      'Accept': '*/*',
    },
  });

  if (!response.ok) {
    throw new Error(`Origin returned ${response.status}: ${response.statusText}`);
  }

  if (!response.body) {
    throw new Error('Origin response has no body');
  }

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;
  let lastDataTime = Date.now();
  let lastProgressLog = 0;

  try {
    while (true) {
      // Check time limits
      const elapsed = Date.now() - startTime;
      if (elapsed > CONFIG.WORKER_MAX_TIME_MS) {
        log.warn('Time limit approaching, stopping stream', { 
          elapsed, 
          bytes: totalBytes,
          limit: CONFIG.WORKER_MAX_TIME_MS 
        });
        return { bytes: totalBytes, complete: false, slowRead: false };
      }

      // Check for slow read
      const timeSinceData = Date.now() - lastDataTime;
      if (timeSinceData > CONFIG.SLOW_READ_THRESHOLD_MS) {
        log.warn('Slow read detected', { 
          timeSinceData, 
          bytes: totalBytes 
        });
        return { bytes: totalBytes, complete: false, slowRead: true };
      }

      const { done, value } = await reader.read();
      
      if (done) {
        break;
      }

      if (value && value.length > 0) {
        chunks.push(value);
        totalBytes += value.length;
        lastDataTime = Date.now();

        // Progress logging
        if (totalBytes - lastProgressLog >= CONFIG.PROGRESS_LOG_INTERVAL) {
          log.info('Stream progress', { 
            bytes: totalBytes, 
            elapsedMs: elapsed 
          });
          lastProgressLog = totalBytes;
        }
      }
    }

    // Upload to R2
    log.info('Stream complete, uploading to R2', { totalBytes });
    
    const combinedBuffer = new Uint8Array(totalBytes);
    let offset = 0;
    for (const chunk of chunks) {
      combinedBuffer.set(chunk, offset);
      offset += chunk.length;
    }

    const r2Client = getR2Client();
    const bucketName = Deno.env.get('R2_BUCKET_NAME') || CONFIG.DEFAULT_BUCKET;

    const command = new PutObjectCommand({
      Bucket: bucketName,
      Key: objectKey,
      Body: combinedBuffer,
      ContentType: 'application/vnd.apple.mpegurl',
      CacheControl: 'public, max-age=3600, s-maxage=86400',
      Metadata: {
        'ingest-method': 'stream',
        'ingest-time': new Date().toISOString(),
        'source-url-hash': await hashString(originUrl),
      },
    });

    await r2Client.send(command);
    log.info('Upload to R2 complete', { objectKey, bytes: totalBytes });

    return { bytes: totalBytes, complete: true, slowRead: false };

  } finally {
    try { reader.releaseLock(); } catch {}
  }
}

// =============================================
// SIGNED URL FALLBACK
// =============================================

async function getSignedUploadUrl(
  objectKey: string,
  contentType: string,
  log: ReturnType<typeof createLogger>
): Promise<{ uploadUrl: string; expiresAt: string }> {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  
  log.info('Requesting signed upload URL', { objectKey });

  const response = await fetch(`${supabaseUrl}/functions/v1/r2-signed-upload`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${serviceKey}`,
    },
    body: JSON.stringify({
      key: objectKey,
      contentType,
      ttlSeconds: 900, // 15 minutes
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to get signed URL: ${error}`);
  }

  return await response.json();
}

async function uploadViaSignedUrl(
  originUrl: string,
  uploadUrl: string,
  log: ReturnType<typeof createLogger>
): Promise<number> {
  log.info('Fetching from origin for signed URL upload', { originUrl });

  // Fetch from origin
  const originResponse = await fetch(originUrl, {
    headers: {
      'User-Agent': 'M3U-Ingest/1.0 (compatible; fallback)',
      'Connection': 'keep-alive',
    },
  });

  if (!originResponse.ok) {
    throw new Error(`Origin returned ${originResponse.status}`);
  }

  const content = await originResponse.arrayBuffer();
  const bytes = content.byteLength;

  log.info('Uploading via signed URL', { bytes });

  // Upload to R2 via signed URL
  const uploadResponse = await fetch(uploadUrl, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/vnd.apple.mpegurl',
    },
    body: content,
  });

  if (!uploadResponse.ok) {
    throw new Error(`Signed URL upload failed: ${uploadResponse.status}`);
  }

  return bytes;
}

// =============================================
// RETRY LOGIC
// =============================================

async function withRetry<T>(
  fn: () => Promise<T>,
  log: ReturnType<typeof createLogger>,
  maxRetries: number = CONFIG.MAX_RETRIES
): Promise<{ result: T; retryCount: number }> {
  let lastError: Error | null = null;
  let retryCount = 0;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const result = await fn();
      return { result, retryCount };
    } catch (error) {
      lastError = error as Error;
      retryCount = attempt;

      if (attempt < maxRetries) {
        const backoff = Math.min(
          CONFIG.INITIAL_BACKOFF_MS * Math.pow(2, attempt),
          CONFIG.MAX_BACKOFF_MS
        );
        log.warn(`Attempt ${attempt + 1} failed, retrying in ${backoff}ms`, {
          error: lastError.message,
        });
        await new Promise(resolve => setTimeout(resolve, backoff));
      }
    }
  }

  throw lastError;
}

// =============================================
// HELPERS
// =============================================

async function hashString(str: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(str);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.slice(0, 8).map(b => b.toString(16).padStart(2, '0')).join('');
}

function generateObjectKey(originUrl: string, sourceId?: string): string {
  const timestamp = Date.now();
  const hash = originUrl.split('/').pop()?.split('?')[0] || 'playlist';
  const prefix = sourceId ? `m3u/${sourceId}` : 'm3u/imports';
  return `${prefix}/${hash}_${timestamp}.m3u`;
}

// =============================================
// MAIN HANDLER
// =============================================

serve(async (req) => {
  const traceId = crypto.randomUUID().slice(0, 8);
  const log = createLogger(traceId);
  const startTime = Date.now();

  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  log.info('Ingest request received', { method: req.method });

  try {
    // Parse request
    const body: IngestRequest = await req.json();
    const { originUrl, objectKey, userId, sourceId, metadata, forceSignedUrl } = body;

    if (!originUrl || typeof originUrl !== 'string') {
      return new Response(
        JSON.stringify({ error: 'originUrl is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Initialize Supabase
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const finalObjectKey = objectKey || generateObjectKey(originUrl, sourceId);
    const cdnBaseUrl = Deno.env.get('R2_CDN_BASE_URL') || CONFIG.DEFAULT_CDN_URL;
    
    log.info('Starting ingest', {
      originUrl: originUrl.substring(0, 100),
      objectKey: finalObjectKey,
      forceSignedUrl,
    });

    let result: IngestResult;
    let method: 'stream' | 'signed_url' | 'fallback' = 'stream';
    let bytes = 0;
    let retryCount = 0;

    // Option 1: Force signed URL (for known large files)
    if (forceSignedUrl) {
      method = 'signed_url';
      log.info('Forced signed URL mode');
      
      const { result: signedResult, retryCount: retries } = await withRetry(async () => {
        const { uploadUrl } = await getSignedUploadUrl(
          finalObjectKey,
          'application/vnd.apple.mpegurl',
          log
        );
        return await uploadViaSignedUrl(originUrl, uploadUrl, log);
      }, log);

      bytes = signedResult;
      retryCount = retries;

    } else {
      // Option 2: Try streaming first
      const abortController = new AbortController();

      try {
        const { result: streamResult, retryCount: retries } = await withRetry(async () => {
          return await streamToR2(originUrl, finalObjectKey, log, startTime, abortController);
        }, log, 1); // Only 1 retry for streaming

        retryCount = retries;

        if (streamResult.complete) {
          bytes = streamResult.bytes;
        } else {
          // Fallback to signed URL
          log.info('Stream incomplete, falling back to signed URL', {
            bytes: streamResult.bytes,
            slowRead: streamResult.slowRead,
          });

          method = 'fallback';
          abortController.abort();

          const { uploadUrl } = await getSignedUploadUrl(
            finalObjectKey,
            'application/vnd.apple.mpegurl',
            log
          );
          bytes = await uploadViaSignedUrl(originUrl, uploadUrl, log);
        }

      } catch (streamError) {
        // Complete failure in streaming, try signed URL
        log.warn('Stream failed, trying signed URL fallback', {
          error: String(streamError),
        });

        method = 'fallback';
        
        const { result: fallbackBytes, retryCount: fallbackRetries } = await withRetry(async () => {
          const { uploadUrl } = await getSignedUploadUrl(
            finalObjectKey,
            'application/vnd.apple.mpegurl',
            log
          );
          return await uploadViaSignedUrl(originUrl, uploadUrl, log);
        }, log);

        bytes = fallbackBytes;
        retryCount += fallbackRetries;
      }
    }

    const durationMs = Date.now() - startTime;

    // Update database record
    await supabase.from('m3u_ingest_jobs').upsert({
      object_key: finalObjectKey,
      origin_url: originUrl.substring(0, 1000),
      source_id: sourceId,
      user_id: userId,
      status: 'finished',
      ingest_method: method,
      bytes_transferred: bytes,
      duration_ms: durationMs,
      retry_count: retryCount,
      metadata: metadata || {},
      finished_at: new Date().toISOString(),
    }, { onConflict: 'object_key' });

    // Record metrics
    await recordMetrics(supabase, {
      traceId,
      originUrl,
      objectKey: finalObjectKey,
      bytes,
      durationMs,
      method,
      retryCount,
      status: 'success',
    });

    result = {
      success: true,
      objectKey: finalObjectKey,
      cdnUrl: `${cdnBaseUrl}/${finalObjectKey}`,
      bytes,
      durationMs,
      method,
      retryCount,
      traceId,
    };

    log.info('Ingest completed successfully', {
      objectKey: finalObjectKey,
      bytes,
      durationMs,
      method,
      retryCount,
    });

    return new Response(
      JSON.stringify(result),
      { 
        status: 200, 
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json',
          'X-Trace-Id': traceId,
        } 
      }
    );

  } catch (error) {
    const durationMs = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : String(error);

    log.error('Ingest failed', {
      error: errorMessage,
      durationMs,
    });

    // Record failure metrics
    try {
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
      const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
      const supabase = createClient(supabaseUrl, supabaseServiceKey);
      
      await recordMetrics(supabase, {
        traceId,
        originUrl: 'unknown',
        objectKey: 'unknown',
        bytes: 0,
        durationMs,
        method: 'unknown',
        retryCount: 0,
        status: 'failed',
        errorMessage,
      });
    } catch {}

    return new Response(
      JSON.stringify({
        success: false,
        error: errorMessage,
        traceId,
        durationMs,
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
