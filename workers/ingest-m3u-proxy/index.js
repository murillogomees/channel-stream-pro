/**
 * Cloudflare Worker: M3U Ingest Proxy
 * 
 * Streams M3U content from origin directly to R2 without buffering.
 * Designed for maximum efficiency and timeout avoidance.
 * 
 * Features:
 * - Zero-buffer streaming: origin.body → R2.put()
 * - Automatic fallback signaling when timeout risk detected
 * - Structured JSON logging
 * - CORS support
 * 
 * @version 1.0.0
 */

// =============================================
// CONFIGURATION
// =============================================

const CONFIG = {
  MAX_RUNTIME_MS: 80000,           // 80s - leave buffer before 100s limit
  FETCH_TIMEOUT_MS: 30000,         // 30s fetch timeout
  CONTENT_TYPE_M3U: 'application/vnd.apple.mpegurl',
  CORS_HEADERS: {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  },
};

// =============================================
// LOGGING
// =============================================

function createLogger(traceId) {
  return {
    info: (message, data = {}) => {
      console.log(JSON.stringify({
        timestamp: new Date().toISOString(),
        traceId,
        level: 'info',
        message,
        ...data,
      }));
    },
    warn: (message, data = {}) => {
      console.log(JSON.stringify({
        timestamp: new Date().toISOString(),
        traceId,
        level: 'warn',
        message,
        ...data,
      }));
    },
    error: (message, data = {}) => {
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
// HELPERS
// =============================================

function generateTraceId() {
  return crypto.randomUUID().slice(0, 8);
}

function jsonResponse(data, status = 200, traceId = null) {
  const headers = {
    'Content-Type': 'application/json',
    ...CONFIG.CORS_HEADERS,
  };
  if (traceId) {
    headers['X-Trace-Id'] = traceId;
  }
  return new Response(JSON.stringify(data), { status, headers });
}

// =============================================
// MAIN HANDLER
// =============================================

export default {
  async fetch(request, env, ctx) {
    const traceId = generateTraceId();
    const log = createLogger(traceId);
    const startTime = Date.now();

    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { 
        status: 204,
        headers: CONFIG.CORS_HEADERS 
      });
    }

    // Health check endpoint
    const url = new URL(request.url);
    if (url.pathname === '/health') {
      return jsonResponse({ 
        status: 'healthy',
        timestamp: new Date().toISOString(),
        traceId,
      });
    }

    try {
      // Parse request parameters
      let originUrl, objectKey;

      if (request.method === 'POST') {
        const body = await request.json();
        originUrl = body.url;
        objectKey = body.key;
      } else {
        originUrl = url.searchParams.get('url');
        objectKey = url.searchParams.get('key');
      }

      if (!originUrl) {
        return jsonResponse({ error: 'Missing url parameter' }, 400, traceId);
      }

      // Generate key if not provided
      if (!objectKey) {
        const filename = originUrl.split('/').pop()?.split('?')[0] || 'playlist';
        objectKey = `m3u/${Date.now()}_${filename}.m3u`;
      }

      log.info('Starting ingest proxy', { 
        originUrl: originUrl.substring(0, 100),
        objectKey,
      });

      // Check R2 bucket binding
      if (!env.R2_BUCKET) {
        log.error('R2_BUCKET binding not configured');
        return jsonResponse({ 
          error: 'R2 not configured',
          need_direct_upload: true,
        }, 500, traceId);
      }

      // Fetch from origin with streaming
      const controller = new AbortController();
      const timeoutId = setTimeout(() => {
        log.warn('Fetch timeout, aborting');
        controller.abort();
      }, CONFIG.FETCH_TIMEOUT_MS);

      let originResponse;
      try {
        originResponse = await fetch(originUrl, {
          signal: controller.signal,
          headers: {
            'User-Agent': 'ingest-worker/1.0 (CloudflareWorker)',
            'Connection': 'keep-alive',
            'Accept': '*/*',
          },
        });
      } catch (fetchError) {
        clearTimeout(timeoutId);
        log.error('Origin fetch failed', { error: fetchError.message });
        
        // Signal that client should use direct upload
        return jsonResponse({
          ok: false,
          need_direct_upload: true,
          error: `Origin fetch failed: ${fetchError.message}`,
          traceId,
        }, 502, traceId);
      }

      clearTimeout(timeoutId);

      if (!originResponse.ok) {
        log.error('Origin returned error', { 
          status: originResponse.status,
          statusText: originResponse.statusText,
        });
        return jsonResponse({
          ok: false,
          error: `Origin returned ${originResponse.status}`,
          traceId,
        }, 502, traceId);
      }

      // Check if we have a body to stream
      if (!originResponse.body) {
        log.error('Origin response has no body');
        return jsonResponse({
          ok: false,
          need_direct_upload: true,
          error: 'Origin response has no body',
          traceId,
        }, 502, traceId);
      }

      // Check content length if available
      const contentLength = originResponse.headers.get('Content-Length');
      if (contentLength) {
        log.info('Content length from origin', { 
          bytes: parseInt(contentLength, 10) 
        });
      }

      // Stream directly to R2
      // R2 accepts ReadableStream directly - no buffering needed!
      try {
        log.info('Starting R2 streaming upload');

        const putResult = await env.R2_BUCKET.put(objectKey, originResponse.body, {
          httpMetadata: {
            contentType: CONFIG.CONTENT_TYPE_M3U,
            cacheControl: 'public, max-age=3600, s-maxage=86400',
          },
          customMetadata: {
            'ingest-method': 'worker-stream',
            'ingest-time': new Date().toISOString(),
            'trace-id': traceId,
          },
        });

        const durationMs = Date.now() - startTime;
        const bytes = putResult?.size || 0;

        log.info('R2 upload complete', {
          objectKey,
          bytes,
          durationMs,
        });

        // Return success
        return jsonResponse({
          ok: true,
          objectKey,
          bytes,
          durationMs,
          method: 'stream',
          traceId,
        }, 200, traceId);

      } catch (r2Error) {
        const elapsed = Date.now() - startTime;
        log.error('R2 upload failed', { 
          error: r2Error.message,
          elapsed,
        });

        // Check if timeout risk
        if (elapsed > CONFIG.MAX_RUNTIME_MS * 0.8) {
          log.warn('Timeout risk detected, signaling fallback');
          
          // Request signed URL from backend
          try {
            const signedResponse = await fetch(`${env.SERVICE_BASE}/functions/v1/r2-signed-upload`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${env.SERVICE_TOKEN}`,
              },
              body: JSON.stringify({
                key: objectKey,
                contentType: CONFIG.CONTENT_TYPE_M3U,
              }),
            });

            if (signedResponse.ok) {
              const signed = await signedResponse.json();
              return jsonResponse({
                ok: false,
                need_direct_upload: true,
                fallback: true,
                signed,
                traceId,
              }, 200, traceId);
            }
          } catch (signedError) {
            log.error('Failed to get signed URL', { error: signedError.message });
          }
        }

        return jsonResponse({
          ok: false,
          need_direct_upload: true,
          error: r2Error.message,
          traceId,
        }, 500, traceId);
      }

    } catch (error) {
      const durationMs = Date.now() - startTime;
      log.error('Unhandled error', { 
        error: error.message,
        durationMs,
      });

      return jsonResponse({
        ok: false,
        error: error.message,
        traceId,
        durationMs,
      }, 500, traceId);
    }
  },
};
