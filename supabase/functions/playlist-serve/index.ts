/**
 * ============================================================================
 * Playlist Serve - Edge Function
 * ============================================================================
 * 
 * Serves playlist data with ETag support and efficient pagination
 * 
 * Endpoints:
 * - GET /playlists - List all playlists
 * - GET /playlist/:key - Get playlist entries with pagination
 * - GET /playlist/:key/categories - Get categories
 * - GET /search - Search entries
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, if-none-match',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
};

const CONFIG = {
  DEFAULT_LIMIT: 500,
  MAX_LIMIT: 5000,
  CACHE_MAX_AGE: 300, // 5 minutes
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: CORS_HEADERS });
  }

  const url = new URL(req.url);
  const path = url.pathname.replace('/playlist-serve', '');

  // Initialize Supabase
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    // GET /playlists
    if (req.method === 'GET' && (path === '/playlists' || path === '')) {
      const { data: playlists, error } = await supabase
        .from('playlist_sources')
        .select('key, name, entries_count, categories_count, last_sync_at, last_sync_status, version, etag')
        .eq('sync_enabled', true)
        .order('name');
      
      if (error) throw error;
      
      return new Response(JSON.stringify({
        playlists: playlists || [],
        count: playlists?.length || 0,
      }), {
        headers: {
          ...CORS_HEADERS,
          'Content-Type': 'application/json',
          'Cache-Control': `public, max-age=${CONFIG.CACHE_MAX_AGE}`,
        },
      });
    }

    // GET /playlist/:key/categories
    if (req.method === 'GET' && path.match(/^\/playlist\/[^/]+\/categories$/)) {
      const key = path.split('/')[2];
      
      const { data: categories, error } = await supabase
        .from('playlist_entries')
        .select('group_title')
        .eq('playlist_key', key)
        .eq('is_valid', true)
        .not('group_title', 'is', null);
      
      if (error) throw error;
      
      // Count entries per category
      const categoryCounts = new Map<string, number>();
      categories?.forEach(c => {
        const count = categoryCounts.get(c.group_title) || 0;
        categoryCounts.set(c.group_title, count + 1);
      });
      
      const sortedCategories = Array.from(categoryCounts.entries())
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => a.name.localeCompare(b.name));
      
      return new Response(JSON.stringify({
        categories: sortedCategories,
        count: sortedCategories.length,
      }), {
        headers: {
          ...CORS_HEADERS,
          'Content-Type': 'application/json',
          'Cache-Control': `public, max-age=${CONFIG.CACHE_MAX_AGE}`,
        },
      });
    }

    // GET /playlist/:key
    if (req.method === 'GET' && path.match(/^\/playlist\/[^/]+$/)) {
      const key = path.split('/')[2];
      const params = url.searchParams;
      
      const limit = Math.min(
        parseInt(params.get('limit') || String(CONFIG.DEFAULT_LIMIT)),
        CONFIG.MAX_LIMIT
      );
      const offset = parseInt(params.get('offset') || '0');
      const category = params.get('category');
      const clientEtag = req.headers.get('if-none-match');
      
      // Get playlist metadata
      const { data: playlist, error: playlistError } = await supabase
        .from('playlist_sources')
        .select('key, name, entries_count, categories_count, version, etag, last_sync_at')
        .eq('key', key)
        .single();
      
      if (playlistError || !playlist) {
        return new Response(JSON.stringify({ error: 'Playlist not found' }), {
          status: 404,
          headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
        });
      }
      
      // Generate ETag based on version and offset
      const serverEtag = `"${playlist.version}-${offset}-${limit}-${category || 'all'}"`;
      
      // Check if client has fresh data
      if (clientEtag === serverEtag) {
        return new Response(null, {
          status: 304,
          headers: {
            ...CORS_HEADERS,
            'ETag': serverEtag,
            'Cache-Control': `public, max-age=${CONFIG.CACHE_MAX_AGE}`,
          },
        });
      }
      
      // Build query
      let query = supabase
        .from('playlist_entries')
        .select('entry_hash, title, stream_url, group_title, tvg_id, tvg_name, tvg_logo, sequence')
        .eq('playlist_key', key)
        .eq('is_valid', true)
        .order('group_title')
        .order('sequence')
        .range(offset, offset + limit - 1);
      
      if (category) {
        query = query.eq('group_title', category);
      }
      
      const { data: entries, error: entriesError } = await query;
      
      if (entriesError) throw entriesError;
      
      // Transform to client format
      const channels = (entries || []).map((e, idx) => ({
        id: e.entry_hash,
        name: e.title,
        stream_url: e.stream_url,
        category_name: e.group_title || 'Outros',
        tvg_id: e.tvg_id,
        tvg_name: e.tvg_name,
        tvg_logo: e.tvg_logo,
        sequence: offset + idx,
      }));
      
      const hasMore = offset + channels.length < playlist.entries_count;
      
      return new Response(JSON.stringify({
        channels,
        total: playlist.entries_count,
        offset,
        limit,
        hasMore,
        version: playlist.version,
        lastSync: playlist.last_sync_at,
      }), {
        headers: {
          ...CORS_HEADERS,
          'Content-Type': 'application/json',
          'ETag': serverEtag,
          'Cache-Control': `public, max-age=${CONFIG.CACHE_MAX_AGE}`,
        },
      });
    }

    // GET /search
    if (req.method === 'GET' && path === '/search') {
      const params = url.searchParams;
      const query = params.get('q');
      const playlistKey = params.get('playlist');
      const category = params.get('category');
      const limit = Math.min(parseInt(params.get('limit') || '100'), 500);
      
      if (!query || query.length < 2) {
        return new Response(JSON.stringify({ error: 'Query must be at least 2 characters' }), {
          status: 400,
          headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
        });
      }
      
      const { data: results, error } = await supabase.rpc('search_playlist_entries', {
        p_query: query,
        p_playlist_key: playlistKey || null,
        p_group_title: category || null,
        p_limit: limit,
      });
      
      if (error) throw error;
      
      return new Response(JSON.stringify({
        results: results || [],
        count: results?.length || 0,
        query,
      }), {
        headers: {
          ...CORS_HEADERS,
          'Content-Type': 'application/json',
        },
      });
    }

    return new Response(JSON.stringify({ error: 'Not found' }), {
      status: 404,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[playlist-serve] Error: ${message}`);
    
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  }
});
