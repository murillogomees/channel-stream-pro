/**
 * M3U Ingest Orchestrator
 * 
 * Stream-safe M3U ingest with automatic fallback to signed URLs.
 * Uses native AWS4 signing (no npm dependencies).
 * 
 * @version 2.0.0
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// =============================================
// CONFIGURATION
// =============================================

const CONFIG = {
  WORKER_MAX_TIME_MS: 80000,
  FETCH_TIMEOUT_MS: 30000,
  SLOW_READ_THRESHOLD_MS: 10000,
  MAX_RETRIES: 3,
  INITIAL_BACKOFF_MS: 1000,
  MAX_BACKOFF_MS: 10000,
  PROGRESS_LOG_INTERVAL: 1000000,
  DEFAULT_BUCKET: 'iptvlink-cdn',
  DEFAULT_CDN_URL: 'https://cdn.iptvlink.app',
};

// =============================================
// AWS4 SIGNING (Native implementation)
// =============================================

async function hmacSha256(key: ArrayBuffer | Uint8Array, message: string): Promise<ArrayBuffer> {
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    key,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  return crypto.subtle.sign('HMAC', cryptoKey, new TextEncoder().encode(message));
}

async function sha256(message: string | Uint8Array): Promise<string> {
  const data = typeof message === 'string' ? new TextEncoder().encode(message) : message;
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hashBuffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

async function getSignatureKey(
  secretKey: string,
  dateStamp: string,
  region: string,
  service: string
): Promise<ArrayBuffer> {
  const kDate = await hmacSha256(new TextEncoder().encode('AWS4' + secretKey), dateStamp);
  const kRegion = await hmacSha256(kDate, region);
  const kService = await hmacSha256(kRegion, service);
  return hmacSha256(kService, 'aws4_request');
}

async function signAndUploadToR2(
  accountId: string,
  accessKeyId: string,
  secretAccessKey: string,
  bucketName: string,
  objectKey: string,
  body: Uint8Array,
  contentType: string
): Promise<void> {
  const region = 'auto';
  const service = 's3';
  const host = `${accountId}.r2.cloudflarestorage.com`;
  const url = `https://${host}/${bucketName}/${objectKey}`;
  
  const now = new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '');
  const dateStamp = amzDate.substring(0, 8);
  
  const payloadHash = await sha256(body);
  
  const headers: Record<string, string> = {
    'host': host,
    'content-type': contentType,
    'x-amz-content-sha256': payloadHash,
    'x-amz-date': amzDate,
    'cache-control': 'public, max-age=3600, s-maxage=86400',
  };
  
  const sortedHeaderKeys = Object.keys(headers).sort();
  const canonicalHeaders = sortedHeaderKeys
    .map(key => `${key}:${headers[key]}`)
    .join('\n') + '\n';
  const signedHeadersStr = sortedHeaderKeys.join(';');
  
  const canonicalUri = `/${bucketName}/${objectKey}`;
  const canonicalRequest = [
    'PUT',
    canonicalUri,
    '',
    canonicalHeaders,
    signedHeadersStr,
    payloadHash,
  ].join('\n');
  
  const algorithm = 'AWS4-HMAC-SHA256';
  const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;
  const stringToSign = [
    algorithm,
    amzDate,
    credentialScope,
    await sha256(canonicalRequest),
  ].join('\n');
  
  const signingKey = await getSignatureKey(secretAccessKey, dateStamp, region, service);
  const signatureBuffer = await hmacSha256(signingKey, stringToSign);
  const signature = Array.from(new Uint8Array(signatureBuffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
  
  const authorizationHeader = `${algorithm} Credential=${accessKeyId}/${credentialScope}, SignedHeaders=${signedHeadersStr}, Signature=${signature}`;
  
  const response = await fetch(url, {
    method: 'PUT',
    headers: {
      ...headers,
      'Authorization': authorizationHeader,
    },
    body: body,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`R2 upload failed: ${response.status} - ${errorText}`);
  }
}

// =============================================
// LOGGING
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
      'User-Agent': 'M3U-Ingest/2.0 (compatible; streaming)',
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
      const elapsed = Date.now() - startTime;
      if (elapsed > CONFIG.WORKER_MAX_TIME_MS) {
        log.warn('Time limit approaching, stopping stream', { 
          elapsed, 
          bytes: totalBytes,
          limit: CONFIG.WORKER_MAX_TIME_MS 
        });
        return { bytes: totalBytes, complete: false, slowRead: false };
      }

      const timeSinceData = Date.now() - lastDataTime;
      if (timeSinceData > CONFIG.SLOW_READ_THRESHOLD_MS) {
        log.warn('Slow read detected', { 
          timeSinceData, 
          bytes: totalBytes 
        });
        return { bytes: totalBytes, complete: false, slowRead: true };
      }

      const { done, value } = await reader.read();
      
      if (done) break;

      if (value && value.length > 0) {
        chunks.push(value);
        totalBytes += value.length;
        lastDataTime = Date.now();

        if (totalBytes - lastProgressLog >= CONFIG.PROGRESS_LOG_INTERVAL) {
          log.info('Stream progress', { 
            bytes: totalBytes, 
            elapsedMs: elapsed 
          });
          lastProgressLog = totalBytes;
        }
      }
    }

    log.info('Stream complete, uploading to R2', { totalBytes });
    
    const combinedBuffer = new Uint8Array(totalBytes);
    let offset = 0;
    for (const chunk of chunks) {
      combinedBuffer.set(chunk, offset);
      offset += chunk.length;
    }

    const accountId = Deno.env.get('R2_ACCOUNT_ID') || Deno.env.get('CLOUDFLARE_ACCOUNT_ID')!;
    const accessKeyId = Deno.env.get('R2_ACCESS_KEY_ID')!;
    const secretAccessKey = Deno.env.get('R2_SECRET_ACCESS_KEY')!;
    const bucketName = Deno.env.get('R2_BUCKET_NAME') || CONFIG.DEFAULT_BUCKET;

    await signAndUploadToR2(
      accountId,
      accessKeyId,
      secretAccessKey,
      bucketName,
      objectKey,
      combinedBuffer,
      'application/vnd.apple.mpegurl'
    );

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
      ttlSeconds: 900,
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

  const originResponse = await fetch(originUrl, {
    headers: {
      'User-Agent': 'M3U-Ingest/2.0 (compatible; fallback)',
      'Connection': 'keep-alive',
    },
  });

  if (!originResponse.ok) {
    throw new Error(`Origin returned ${originResponse.status}`);
  }

  const content = await originResponse.arrayBuffer();
  const bytes = content.byteLength;

  log.info('Uploading via signed URL', { bytes });

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

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  log.info('Ingest request received', { method: req.method });

  try {
    const body = await req.json();
    const { originUrl, objectKey, sourceId, forceSignedUrl } = body;

    if (!originUrl || typeof originUrl !== 'string') {
      return new Response(
        JSON.stringify({ error: 'originUrl is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

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

    let method: 'stream' | 'signed_url' | 'fallback' = 'stream';
    let bytes = 0;
    let retryCount = 0;

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
      const abortController = new AbortController();

      try {
        const { result: streamResult, retryCount: retries } = await withRetry(async () => {
          return await streamToR2(originUrl, finalObjectKey, log, startTime, abortController);
        }, log, 1);

        retryCount = retries;

        if (streamResult.complete) {
          bytes = streamResult.bytes;
        } else {
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
      } catch (error) {
        log.warn('Stream failed, trying signed URL', { error: String(error) });
        method = 'fallback';
        
        const { uploadUrl } = await getSignedUploadUrl(
          finalObjectKey,
          'application/vnd.apple.mpegurl',
          log
        );
        bytes = await uploadViaSignedUrl(originUrl, uploadUrl, log);
      }
    }

    const durationMs = Date.now() - startTime;

    // Record metrics (non-blocking)
    supabase.from('m3u_ingest_metrics').insert({
      trace_id: traceId,
      origin_url: originUrl.substring(0, 500),
      object_key: finalObjectKey,
      bytes_transferred: bytes,
      duration_ms: durationMs,
      ingest_method: method,
      retry_count: retryCount,
      status: 'success',
      created_at: new Date().toISOString(),
    }).catch(err => {
      log.warn('Failed to record metrics', { error: String(err) });
    });

    // Update job status (non-blocking)
    supabase.from('m3u_ingest_jobs').insert({
      trace_id: traceId,
      origin_url: originUrl,
      object_key: finalObjectKey,
      status: 'completed',
      bytes_transferred: bytes,
      ingest_method: method,
      retry_count: retryCount,
      duration_ms: durationMs,
      cdn_url: `${cdnBaseUrl}/${finalObjectKey}`,
      created_at: new Date().toISOString(),
      completed_at: new Date().toISOString(),
    }).catch(err => {
      log.warn('Failed to update job status', { error: String(err) });
    });

    log.info('Ingest completed successfully', {
      objectKey: finalObjectKey,
      bytes,
      durationMs,
      method,
      retryCount,
    });

    return new Response(
      JSON.stringify({
        success: true,
        objectKey: finalObjectKey,
        cdnUrl: `${cdnBaseUrl}/${finalObjectKey}`,
        bytes,
        durationMs,
        method,
        retryCount,
        traceId,
      }),
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
    log.error('Ingest failed', {
      error: String(error),
      durationMs,
    });

    return new Response(
      JSON.stringify({ 
        success: false,
        error: 'Ingest failed',
        details: String(error),
        traceId,
        durationMs,
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
