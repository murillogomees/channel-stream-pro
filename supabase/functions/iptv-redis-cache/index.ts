import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface RedisCacheRequest {
  action: 'get' | 'set' | 'delete' | 'flush' | 'keys' | 'stats' | 'warmup' | 'ttl';
  key?: string;
  pattern?: string;
  value?: unknown;
  ttl?: number;
  channelIds?: number[];
}

// In-memory cache simulation (for edge function context)
// In production, this would connect to actual Redis via REDIS_URL
const memoryCache = new Map<string, { value: unknown; expiresAt: number }>();

function getRedisUrl(): string | null {
  return Deno.env.get('REDIS_URL') || null;
}

async function redisCommand(command: string, args: string[]): Promise<unknown> {
  const redisUrl = getRedisUrl();
  
  if (!redisUrl) {
    // Fallback to memory cache simulation
    console.log('[redis-cache] No REDIS_URL configured, using memory cache');
    return null;
  }

  // Parse Redis URL and execute command
  // Format: redis://user:password@host:port
  try {
    const url = new URL(redisUrl);
    const host = url.hostname;
    const port = parseInt(url.port) || 6379;
    const password = url.password;

    // For now, we'll use the database fallback
    // In production, you'd use a proper Redis client or connect via TCP
    console.log(`[redis-cache] Would connect to Redis at ${host}:${port}`);
    return null;
  } catch (e) {
    console.error('[redis-cache] Redis connection error:', e);
    return null;
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body: RedisCacheRequest = await req.json();
    console.log('[iptv-redis-cache] Request:', body.action);

    switch (body.action) {
      case 'get': {
        if (!body.key) {
          return new Response(JSON.stringify({ error: 'key required' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        // Try memory cache first
        const cached = memoryCache.get(body.key);
        if (cached && cached.expiresAt > Date.now()) {
          return new Response(JSON.stringify({ 
            value: cached.value, 
            source: 'memory',
            ttl: Math.floor((cached.expiresAt - Date.now()) / 1000)
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        // Try database cache
        const { data } = await supabase
          .from('iptv_cdn_cache')
          .select('*')
          .eq('cache_key', body.key)
          .single();

        if (data && data.expires_at && new Date(data.expires_at) > new Date()) {
          // Update last access
          await supabase
            .from('iptv_cdn_cache')
            .update({ last_access_at: new Date().toISOString(), is_warm: true })
            .eq('id', data.id);

          return new Response(JSON.stringify({ 
            value: data.manifest_url,
            source: 'database',
            ttl: Math.floor((new Date(data.expires_at).getTime() - Date.now()) / 1000)
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        return new Response(JSON.stringify({ value: null }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      case 'set': {
        if (!body.key || body.value === undefined) {
          return new Response(JSON.stringify({ error: 'key and value required' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        const ttlSeconds = body.ttl || 3600; // Default 1 hour
        const expiresAt = new Date(Date.now() + ttlSeconds * 1000);

        // Set in memory cache
        memoryCache.set(body.key, {
          value: body.value,
          expiresAt: expiresAt.getTime(),
        });

        // Set in database cache
        const { error } = await supabase
          .from('iptv_cdn_cache')
          .upsert({
            cache_key: body.key,
            manifest_url: typeof body.value === 'string' ? body.value : JSON.stringify(body.value),
            cdn_provider: 'redis',
            is_warm: true,
            expires_at: expiresAt.toISOString(),
            last_access_at: new Date().toISOString(),
          }, {
            onConflict: 'cache_key',
          });

        if (error) throw error;

        return new Response(JSON.stringify({ success: true, ttl: ttlSeconds }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      case 'delete': {
        if (!body.key && !body.pattern) {
          return new Response(JSON.stringify({ error: 'key or pattern required' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        let deleted = 0;

        if (body.key) {
          memoryCache.delete(body.key);
          const { count } = await supabase
            .from('iptv_cdn_cache')
            .delete()
            .eq('cache_key', body.key);
          deleted = count || 0;
        } else if (body.pattern) {
          // Delete by pattern (like Redis KEYS)
          const sqlPattern = body.pattern.replace('*', '%');
          const { count } = await supabase
            .from('iptv_cdn_cache')
            .delete()
            .ilike('cache_key', sqlPattern);
          deleted = count || 0;

          // Clear memory cache matching pattern
          const regex = new RegExp(body.pattern.replace('*', '.*'));
          for (const key of memoryCache.keys()) {
            if (regex.test(key)) {
              memoryCache.delete(key);
            }
          }
        }

        return new Response(JSON.stringify({ success: true, deleted }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      case 'flush': {
        // Clear all cache
        memoryCache.clear();
        
        const { count } = await supabase
          .from('iptv_cdn_cache')
          .delete()
          .neq('id', 0);

        console.log('[iptv-redis-cache] Flushed all cache, deleted:', count);

        return new Response(JSON.stringify({ success: true, deleted: count }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      case 'keys': {
        const pattern = body.pattern || '*';
        const sqlPattern = pattern.replace('*', '%');

        const { data, error } = await supabase
          .from('iptv_cdn_cache')
          .select('cache_key, is_warm, expires_at')
          .ilike('cache_key', sqlPattern)
          .limit(1000);

        if (error) throw error;

        return new Response(JSON.stringify({ 
          keys: data?.map(d => d.cache_key) || [],
          details: data || []
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      case 'stats': {
        const { data: cacheData, error } = await supabase
          .from('iptv_cdn_cache')
          .select('*');

        if (error) throw error;

        const now = new Date();
        const stats = {
          totalKeys: cacheData?.length || 0,
          warmKeys: cacheData?.filter(c => c.is_warm).length || 0,
          coldKeys: cacheData?.filter(c => !c.is_warm).length || 0,
          expiredKeys: cacheData?.filter(c => c.expires_at && new Date(c.expires_at) < now).length || 0,
          memoryKeys: memoryCache.size,
          providers: [...new Set(cacheData?.map(c => c.cdn_provider) || [])],
          redisConfigured: !!getRedisUrl(),
        };

        return new Response(JSON.stringify({ stats }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      case 'warmup': {
        if (!body.channelIds || body.channelIds.length === 0) {
          return new Response(JSON.stringify({ error: 'channelIds required' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        // Get channels to warm
        const { data: channels, error } = await supabase
          .from('iptv_channels')
          .select('id, name, original_url, transcode_manifest_url')
          .in('id', body.channelIds);

        if (error) throw error;

        const warmed: number[] = [];
        const ttl = body.ttl || 3600;

        for (const channel of channels || []) {
          const cacheKey = `channel:${channel.id}:manifest`;
          const manifestUrl = channel.transcode_manifest_url || channel.original_url;

          // Set in cache
          await supabase
            .from('iptv_cdn_cache')
            .upsert({
              cache_key: cacheKey,
              channel_id: channel.id,
              manifest_url: manifestUrl,
              cdn_provider: 'warmup',
              is_warm: true,
              expires_at: new Date(Date.now() + ttl * 1000).toISOString(),
              last_access_at: new Date().toISOString(),
            }, {
              onConflict: 'cache_key',
            });

          warmed.push(channel.id);
        }

        console.log('[iptv-redis-cache] Warmed up channels:', warmed.length);

        return new Response(JSON.stringify({ success: true, warmed }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      case 'ttl': {
        if (!body.key) {
          return new Response(JSON.stringify({ error: 'key required' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        const { data } = await supabase
          .from('iptv_cdn_cache')
          .select('expires_at')
          .eq('cache_key', body.key)
          .single();

        if (!data || !data.expires_at) {
          return new Response(JSON.stringify({ ttl: -2 }), { // Key doesn't exist
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        const ttl = Math.floor((new Date(data.expires_at).getTime() - Date.now()) / 1000);
        return new Response(JSON.stringify({ ttl: ttl > 0 ? ttl : -1 }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      default:
        return new Response(JSON.stringify({ error: 'Invalid action' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }
  } catch (error) {
    console.error('[iptv-redis-cache] Error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});