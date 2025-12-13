/**
 * Cloudflare Worker - IPTV Cache Manager
 * Handles intelligent caching with tiered storage (KV + R2)
 */

interface Env {
  CACHE_KV: KVNamespace;
  R2_BUCKET: R2Bucket;
  SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  WORKER_SECRET: string;
}

interface CacheEntry {
  key: string;
  value: unknown;
  metadata: {
    createdAt: string;
    expiresAt?: string;
    accessCount: number;
    lastAccessAt: string;
    size: number;
    source: 'kv' | 'r2';
  };
}

interface CacheStats {
  kvKeys: number;
  r2Objects: number;
  totalSize: number;
  hitRate: number;
  warmKeys: number;
  coldKeys: number;
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Worker-Secret',
};

// TTL configurations (in seconds)
const TTL_CONFIG = {
  manifest: 10,        // HLS manifests - very short
  segment: 300,        // TS segments - 5 minutes
  metadata: 3600,      // Channel metadata - 1 hour
  epg: 86400,          // EPG data - 24 hours
  thumbnail: 604800,   // Thumbnails - 1 week
  default: 300,        // Default - 5 minutes
};

async function verifyAuth(request: Request, env: Env): Promise<boolean> {
  const secret = request.headers.get('X-Worker-Secret');
  return secret === env.WORKER_SECRET;
}

function getCacheType(key: string): keyof typeof TTL_CONFIG {
  if (key.includes('.m3u8') || key.includes('manifest')) return 'manifest';
  if (key.includes('.ts') || key.includes('segment')) return 'segment';
  if (key.includes('metadata') || key.includes('channel_')) return 'metadata';
  if (key.includes('epg') || key.includes('program')) return 'epg';
  if (key.includes('thumb') || key.includes('logo')) return 'thumbnail';
  return 'default';
}

function getDefaultTTL(key: string): number {
  const type = getCacheType(key);
  return TTL_CONFIG[type];
}

async function getFromKV(env: Env, key: string): Promise<{ value: unknown; metadata: Record<string, unknown> } | null> {
  const result = await env.CACHE_KV.getWithMetadata(key, 'json');
  if (result.value) {
    // Update access metadata
    const metadata = (result.metadata || {}) as Record<string, unknown>;
    metadata.accessCount = ((metadata.accessCount as number) || 0) + 1;
    metadata.lastAccessAt = new Date().toISOString();
    
    // Async update metadata without blocking
    env.CACHE_KV.put(key, JSON.stringify(result.value), {
      metadata,
      expirationTtl: metadata.ttl as number || getDefaultTTL(key),
    });
    
    return { value: result.value, metadata };
  }
  return null;
}

async function getFromR2(env: Env, key: string): Promise<{ value: unknown; metadata: Record<string, unknown> } | null> {
  const object = await env.R2_BUCKET.get(`cache/${key}`);
  if (object) {
    const value = await object.json();
    const metadata = object.customMetadata || {};
    return { value, metadata };
  }
  return null;
}

async function setToKV(
  env: Env,
  key: string,
  value: unknown,
  ttl?: number
): Promise<void> {
  const effectiveTTL = ttl || getDefaultTTL(key);
  const metadata = {
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + effectiveTTL * 1000).toISOString(),
    accessCount: 0,
    size: JSON.stringify(value).length,
    ttl: effectiveTTL,
  };

  await env.CACHE_KV.put(key, JSON.stringify(value), {
    expirationTtl: effectiveTTL,
    metadata,
  });
}

async function setToR2(
  env: Env,
  key: string,
  value: unknown,
  ttl?: number
): Promise<void> {
  const metadata = {
    createdAt: new Date().toISOString(),
    expiresAt: ttl ? new Date(Date.now() + ttl * 1000).toISOString() : undefined,
    accessCount: '0',
    size: String(JSON.stringify(value).length),
  };

  await env.R2_BUCKET.put(`cache/${key}`, JSON.stringify(value), {
    customMetadata: metadata,
  });
}

async function handleGet(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const key = url.searchParams.get('key');

  if (!key) {
    return Response.json({ error: 'Key required' }, { status: 400 });
  }

  // Try KV first (hot cache)
  let result = await getFromKV(env, key);
  if (result) {
    return Response.json({
      value: result.value,
      source: 'kv',
      metadata: result.metadata,
    });
  }

  // Try R2 (cold cache)
  result = await getFromR2(env, key);
  if (result) {
    // Promote to KV for faster access
    await setToKV(env, key, result.value);
    
    return Response.json({
      value: result.value,
      source: 'r2',
      metadata: result.metadata,
    });
  }

  return Response.json({ value: null, source: 'miss' });
}

async function handleSet(request: Request, env: Env): Promise<Response> {
  const { key, value, ttl, tier } = await request.json() as {
    key: string;
    value: unknown;
    ttl?: number;
    tier?: 'kv' | 'r2' | 'both';
  };

  if (!key || value === undefined) {
    return Response.json({ error: 'Key and value required' }, { status: 400 });
  }

  const effectiveTier = tier || 'kv';
  const size = JSON.stringify(value).length;

  // Large values (>25KB) go to R2
  if (size > 25 * 1024 && effectiveTier === 'kv') {
    await setToR2(env, key, value, ttl);
    return Response.json({ success: true, tier: 'r2', size });
  }

  if (effectiveTier === 'both') {
    await Promise.all([
      setToKV(env, key, value, ttl),
      setToR2(env, key, value, ttl),
    ]);
    return Response.json({ success: true, tier: 'both', size });
  }

  if (effectiveTier === 'r2') {
    await setToR2(env, key, value, ttl);
    return Response.json({ success: true, tier: 'r2', size });
  }

  await setToKV(env, key, value, ttl);
  return Response.json({ success: true, tier: 'kv', size });
}

async function handleDelete(request: Request, env: Env): Promise<Response> {
  const { key, pattern } = await request.json() as { key?: string; pattern?: string };

  if (pattern) {
    // Pattern-based deletion (R2 only supports prefix)
    const listed = await env.R2_BUCKET.list({ prefix: `cache/${pattern}` });
    const deleted: string[] = [];
    
    for (const object of listed.objects) {
      await env.R2_BUCKET.delete(object.key);
      deleted.push(object.key);
    }

    // KV requires listing keys
    const kvKeys = await env.CACHE_KV.list({ prefix: pattern });
    for (const kvKey of kvKeys.keys) {
      await env.CACHE_KV.delete(kvKey.name);
      deleted.push(kvKey.name);
    }

    return Response.json({ success: true, deleted: deleted.length });
  }

  if (key) {
    await Promise.all([
      env.CACHE_KV.delete(key),
      env.R2_BUCKET.delete(`cache/${key}`),
    ]);
    return Response.json({ success: true });
  }

  return Response.json({ error: 'Key or pattern required' }, { status: 400 });
}

async function handleFlush(env: Env): Promise<Response> {
  // List and delete all KV keys
  let kvDeleted = 0;
  let cursor: string | undefined;
  
  do {
    const listed = await env.CACHE_KV.list({ cursor });
    for (const key of listed.keys) {
      await env.CACHE_KV.delete(key.name);
      kvDeleted++;
    }
    cursor = listed.list_complete ? undefined : listed.cursor;
  } while (cursor);

  // List and delete all R2 cache objects
  let r2Deleted = 0;
  const r2Listed = await env.R2_BUCKET.list({ prefix: 'cache/' });
  for (const object of r2Listed.objects) {
    await env.R2_BUCKET.delete(object.key);
    r2Deleted++;
  }

  return Response.json({ 
    success: true, 
    deleted: { kv: kvDeleted, r2: r2Deleted } 
  });
}

async function handleWarmup(request: Request, env: Env): Promise<Response> {
  const { channelIds, ttl } = await request.json() as { 
    channelIds: number[]; 
    ttl?: number;
  };

  if (!channelIds?.length) {
    return Response.json({ error: 'channelIds required' }, { status: 400 });
  }

  // Fetch channel data from Supabase
  const response = await fetch(
    `${env.SUPABASE_URL}/rest/v1/iptv_channels?id=in.(${channelIds.join(',')})`,
    {
      headers: {
        'Authorization': `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
        'apikey': env.SUPABASE_SERVICE_ROLE_KEY,
      },
    }
  );

  const channels = await response.json() as Array<{
    id: number;
    name: string;
    original_url: string;
    logo_url: string;
    category: string;
  }>;

  const warmed: number[] = [];

  for (const channel of channels) {
    const cacheKey = `channel_${channel.id}_metadata`;
    await setToKV(env, cacheKey, {
      id: channel.id,
      name: channel.name,
      url: channel.original_url,
      logo: channel.logo_url,
      category: channel.category,
      cachedAt: new Date().toISOString(),
    }, ttl || TTL_CONFIG.metadata);
    
    warmed.push(channel.id);
  }

  // Update cache table in Supabase
  for (const channelId of warmed) {
    await fetch(`${env.SUPABASE_URL}/rest/v1/iptv_cdn_cache`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
        'apikey': env.SUPABASE_SERVICE_ROLE_KEY,
        'Prefer': 'resolution=merge-duplicates',
      },
      body: JSON.stringify({
        channel_id: channelId,
        cache_key: `channel_${channelId}_metadata`,
        cdn_provider: 'cloudflare',
        is_warm: true,
        last_access_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + (ttl || TTL_CONFIG.metadata) * 1000).toISOString(),
      }),
    });
  }

  return Response.json({ success: true, warmed });
}

async function handleStats(env: Env): Promise<Response> {
  // Get KV stats
  const kvListed = await env.CACHE_KV.list();
  const kvKeys = kvListed.keys.length;

  // Get R2 stats
  const r2Listed = await env.R2_BUCKET.list({ prefix: 'cache/' });
  const r2Objects = r2Listed.objects.length;
  const r2Size = r2Listed.objects.reduce((acc, obj) => acc + obj.size, 0);

  // Calculate warm/cold keys
  const now = Date.now();
  let warmKeys = 0;
  let coldKeys = 0;

  for (const key of kvListed.keys) {
    const metadata = key.metadata as Record<string, unknown> | undefined;
    if (metadata?.lastAccessAt) {
      const lastAccess = new Date(metadata.lastAccessAt as string).getTime();
      if (now - lastAccess < 5 * 60 * 1000) { // 5 minutes
        warmKeys++;
      } else {
        coldKeys++;
      }
    }
  }

  const stats: CacheStats = {
    kvKeys,
    r2Objects,
    totalSize: r2Size,
    hitRate: 0, // Would need metrics tracking
    warmKeys,
    coldKeys,
  };

  return Response.json({ stats });
}

async function handleKeys(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const prefix = url.searchParams.get('prefix') || '';
  const limit = parseInt(url.searchParams.get('limit') || '100');

  const kvListed = await env.CACHE_KV.list({ prefix, limit });
  const r2Listed = await env.R2_BUCKET.list({ prefix: `cache/${prefix}`, limit });

  const keys = [
    ...kvListed.keys.map(k => ({
      key: k.name,
      tier: 'kv' as const,
      metadata: k.metadata,
    })),
    ...r2Listed.objects.map(o => ({
      key: o.key.replace('cache/', ''),
      tier: 'r2' as const,
      size: o.size,
      uploaded: o.uploaded,
    })),
  ];

  return Response.json({ keys, total: keys.length });
}

async function handleRequest(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const path = url.pathname;

  // Route handling
  if (request.method === 'GET') {
    if (path === '/get') return handleGet(request, env);
    if (path === '/stats') return handleStats(env);
    if (path === '/keys') return handleKeys(request, env);
  }

  if (request.method === 'POST') {
    const { action, ...params } = await request.json() as { action: string } & Record<string, unknown>;

    switch (action) {
      case 'get': {
        const result = await getFromKV(env, params.key as string) || await getFromR2(env, params.key as string);
        return Response.json(result || { value: null });
      }
      case 'set':
        return handleSet(new Request(request.url, { 
          method: 'POST', 
          body: JSON.stringify(params) 
        }), env);
      case 'delete':
        return handleDelete(new Request(request.url, {
          method: 'POST',
          body: JSON.stringify(params),
        }), env);
      case 'flush':
        return handleFlush(env);
      case 'warmup':
        return handleWarmup(new Request(request.url, {
          method: 'POST',
          body: JSON.stringify(params),
        }), env);
      case 'stats':
        return handleStats(env);
      case 'keys':
        return handleKeys(request, env);
      case 'ttl': {
        const result = await getFromKV(env, params.key as string);
        if (result?.metadata) {
          const expiresAt = new Date(result.metadata.expiresAt as string).getTime();
          const ttl = Math.max(0, Math.floor((expiresAt - Date.now()) / 1000));
          return Response.json({ ttl });
        }
        return Response.json({ ttl: -1 });
      }
      default:
        return Response.json({ error: 'Invalid action' }, { status: 400 });
    }
  }

  return Response.json({ error: 'Method not allowed' }, { status: 405 });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    const url = new URL(request.url);

    // Health check
    if (url.pathname === '/health') {
      return Response.json({
        status: 'healthy',
        service: 'cache-worker',
        timestamp: new Date().toISOString(),
      }, { headers: corsHeaders });
    }

    // Auth check
    if (!await verifyAuth(request, env)) {
      return Response.json({ error: 'Unauthorized' }, { status: 401, headers: corsHeaders });
    }

    try {
      const response = await handleRequest(request, env);
      return new Response(response.body, {
        ...response,
        headers: { ...corsHeaders, ...Object.fromEntries(response.headers) },
      });
    } catch (error) {
      console.error('Cache worker error:', error);
      return Response.json(
        { error: error instanceof Error ? error.message : 'Internal error' },
        { status: 500, headers: corsHeaders }
      );
    }
  },
};
