/**
 * Cloudflare Edge Router Worker
 * 
 * Routes streaming requests based on policy engine decisions:
 * - VOD → Cloudflare Stream (signed URLs)
 * - Live → Direct origin (low latency)
 * - Agile → Origin with edge cache
 * 
 * Deploy: wrangler deploy
 */

// Configuration (set via wrangler.toml or dashboard)
const SUPABASE_URL = typeof SUPABASE_URL_VAR !== 'undefined' ? SUPABASE_URL_VAR : '';
const SUPABASE_ANON_KEY = typeof SUPABASE_ANON_KEY_VAR !== 'undefined' ? SUPABASE_ANON_KEY_VAR : '';
const CLOUDFLARE_ACCOUNT_ID = typeof CF_ACCOUNT_ID !== 'undefined' ? CF_ACCOUNT_ID : '';
const SIGNING_KEY = typeof CF_STREAM_SIGNING_KEY !== 'undefined' ? CF_STREAM_SIGNING_KEY : '';

// In-memory cache for routing decisions (TTL: 60s)
const routingCache = new Map();
const CACHE_TTL = 60000;

// Health check state
let streamHealthy = true;
let lastHealthCheck = 0;
const HEALTH_CHECK_INTERVAL = 30000;

addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request, event));
});

async function handleRequest(request, event) {
  const url = new URL(request.url);
  const path = url.pathname;

  // CORS preflight
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      }
    });
  }

  // Health check endpoint
  if (path === '/health') {
    return new Response(JSON.stringify({
      status: 'ok',
      streamHealthy,
      lastHealthCheck: new Date(lastHealthCheck).toISOString(),
      cacheSize: routingCache.size
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  }

  // Metrics endpoint
  if (path === '/metrics') {
    return new Response(JSON.stringify({
      cache_entries: routingCache.size,
      stream_healthy: streamHealthy,
      uptime_ms: Date.now() - lastHealthCheck
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  }

  // Main routing: /play/:channelId or /manifest/:channelId
  const playMatch = path.match(/^\/(play|manifest)\/([a-f0-9-]+)/i);
  if (playMatch) {
    const channelId = playMatch[2];
    return await handlePlayRequest(request, channelId, event);
  }

  // Direct stream proxy: /stream/:cfStreamUid
  const streamMatch = path.match(/^\/stream\/([a-f0-9]+)/i);
  if (streamMatch) {
    const cfStreamUid = streamMatch[1];
    return await proxyCloudflareStream(request, cfStreamUid);
  }

  return new Response('Not Found', { status: 404 });
}

async function handlePlayRequest(request, channelId, event) {
  try {
    // Get routing decision (cached)
    const routing = await getRoutingDecision(channelId);
    
    if (!routing) {
      return new Response(JSON.stringify({ error: 'Channel not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Log metric async (don't wait)
    event.waitUntil(recordMetric(channelId, 'request', 1));

    // Force origin fallback if Stream is unhealthy
    if (!streamHealthy && routing.strategy === 'USE_STREAM') {
      console.log(`[EdgeRouter] Stream unhealthy, forcing origin for ${channelId}`);
      return await forwardToOrigin(request, routing, { addCache: true });
    }

    // Route based on strategy
    switch (routing.strategy) {
      case 'USE_STREAM':
        if (routing.cf_stream_url) {
          // Redirect to Cloudflare Stream (optionally with signed URL)
          const streamUrl = await getSignedStreamUrl(routing.cf_stream_url);
          return Response.redirect(streamUrl, 302);
        }
        // Fallback to origin if no Stream URL
        return await forwardToOrigin(request, routing);

      case 'STREAM_ON_DEMAND':
        // Trigger transcode job async, serve from origin now
        event.waitUntil(triggerOnDemandTranscode(channelId));
        return await forwardToOrigin(request, routing, { addCache: true });

      case 'USE_ORIGIN':
      default:
        return await forwardToOrigin(request, routing);
    }
  } catch (error) {
    console.error('[EdgeRouter] Error:', error);
    return new Response(JSON.stringify({ error: 'Internal error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

async function getRoutingDecision(channelId) {
  // Check cache first
  const cacheKey = `routing:${channelId}`;
  const cached = routingCache.get(cacheKey);
  
  if (cached && (Date.now() - cached.timestamp < CACHE_TTL)) {
    return cached.data;
  }

  // Fetch from Supabase
  try {
    const response = await fetch(
      `${SUPABASE_URL}/rest/v1/rpc/get_channel_routing_strategy`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
        },
        body: JSON.stringify({ p_channel_id: channelId })
      }
    );

    if (!response.ok) {
      console.error('[EdgeRouter] Supabase error:', response.status);
      return null;
    }

    const data = await response.json();
    const routing = data?.[0] || null;

    // Cache the result
    if (routing) {
      routingCache.set(cacheKey, { data: routing, timestamp: Date.now() });
    }

    return routing;
  } catch (error) {
    console.error('[EdgeRouter] Failed to fetch routing:', error);
    return null;
  }
}

async function forwardToOrigin(request, routing, options = {}) {
  const originUrl = routing.r2_url || routing.origin_url;
  
  if (!originUrl) {
    return new Response('Origin not configured', { status: 502 });
  }

  const newRequest = new Request(originUrl, {
    method: request.method,
    headers: request.headers
  });

  try {
    const response = await fetch(newRequest);
    
    // Clone response with custom headers
    const newHeaders = new Headers(response.headers);
    newHeaders.set('X-Routed-By', 'edge-router');
    newHeaders.set('X-Routing-Source', routing.source || 'default');
    
    if (options.addCache) {
      newHeaders.set('Cache-Control', 'public, max-age=60');
    }

    return new Response(response.body, {
      status: response.status,
      headers: newHeaders
    });
  } catch (error) {
    console.error('[EdgeRouter] Origin fetch error:', error);
    return new Response('Origin unavailable', { status: 502 });
  }
}

async function proxyCloudflareStream(request, cfStreamUid) {
  const streamUrl = `https://customer-${CLOUDFLARE_ACCOUNT_ID}.cloudflarestream.com/${cfStreamUid}/manifest/video.m3u8`;
  const signedUrl = await getSignedStreamUrl(streamUrl);
  
  try {
    const response = await fetch(signedUrl, {
      headers: request.headers
    });
    
    return new Response(response.body, {
      status: response.status,
      headers: {
        ...Object.fromEntries(response.headers),
        'X-Routed-By': 'edge-router',
        'X-Stream-Source': 'cloudflare-stream'
      }
    });
  } catch (error) {
    console.error('[EdgeRouter] Stream proxy error:', error);
    return new Response('Stream unavailable', { status: 502 });
  }
}

async function getSignedStreamUrl(baseUrl) {
  if (!SIGNING_KEY) {
    return baseUrl;
  }

  try {
    // Extract UID from URL
    const match = baseUrl.match(/cloudflarestream\.com\/([a-f0-9]+)\//i);
    if (!match) return baseUrl;
    
    const uid = match[1];
    const expiresAt = Math.floor(Date.now() / 1000) + 3600; // 1 hour
    
    const payload = JSON.stringify({
      sub: uid,
      kid: CLOUDFLARE_ACCOUNT_ID,
      exp: expiresAt,
      accessRules: [{ type: 'any', action: 'allow' }]
    });

    const base64Payload = btoa(payload)
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');

    const signature = await signHmac(base64Payload, SIGNING_KEY);
    
    return `${baseUrl}?token=${base64Payload}.${signature}`;
  } catch (error) {
    console.error('[EdgeRouter] Signing error:', error);
    return baseUrl;
  }
}

async function signHmac(data, secret) {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(secret);
  const messageData = encoder.encode(data);

  const key = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signature = await crypto.subtle.sign('HMAC', key, messageData);
  const signatureArray = Array.from(new Uint8Array(signature));
  return signatureArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

async function triggerOnDemandTranscode(channelId) {
  // TODO: Call edge function to trigger transcode
  console.log(`[EdgeRouter] Triggering on-demand transcode for ${channelId}`);
}

async function recordMetric(channelId, metricType, value) {
  try {
    await fetch(`${SUPABASE_URL}/rest/v1/streaming_metrics`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'Prefer': 'return=minimal'
      },
      body: JSON.stringify({
        channel_id: channelId,
        metric_type: metricType,
        value: value,
        metadata: { source: 'edge-router' }
      })
    });
  } catch (error) {
    // Don't fail request for metric errors
    console.error('[EdgeRouter] Metric error:', error);
  }
}

// Periodic health check for Cloudflare Stream
async function checkStreamHealth() {
  if (Date.now() - lastHealthCheck < HEALTH_CHECK_INTERVAL) {
    return;
  }

  try {
    const testUrl = `https://customer-${CLOUDFLARE_ACCOUNT_ID}.cloudflarestream.com/health`;
    const response = await fetch(testUrl, { method: 'HEAD' });
    streamHealthy = response.ok;
  } catch {
    streamHealthy = false;
  }
  
  lastHealthCheck = Date.now();
}
