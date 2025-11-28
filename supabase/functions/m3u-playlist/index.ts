import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }
  
  const url = new URL(req.url);
  const pathParts = url.pathname.replace('/m3u-playlist', '').split('/').filter(Boolean);
  
  if (pathParts.length === 0) {
    return new Response(JSON.stringify({ error: 'Playlist key required' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
  
  let key = pathParts[0];
  const format = url.searchParams.get('format') || 'm3u';
  const isGzip = key.endsWith('.gz') || format === 'gz';
  const isJson = key.endsWith('.json') || format === 'json';
  
  // Clean key
  key = key.replace(/\.(m3u|gz|json)$/g, '');
  
  // Initialize Supabase client
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseKey);
  
  try {
    console.log(`[M3U-Playlist] Serving ${key} (format: ${isJson ? 'json' : isGzip ? 'gz' : 'm3u'})`);
    
    // Get source
    const { data: source, error: sourceError } = await supabase
      .from('m3u_sync_sources')
      .select('id, key, name, last_sync_at, entries_count')
      .eq('key', key)
      .eq('enabled', true)
      .single();
    
    if (sourceError || !source) {
      return new Response(JSON.stringify({ error: 'Playlist not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    
    // Get entries
    const { data: entries, error: entriesError } = await supabase
      .from('m3u_sync_entries')
      .select('title, stream_url, group_title, tvg_id, tvg_name, tvg_logo, tvg_language, duration')
      .eq('source_id', source.id)
      .eq('is_valid', true)
      .order('group_title')
      .order('title');
    
    if (entriesError) throw entriesError;
    
    if (!entries || entries.length === 0) {
      return new Response(JSON.stringify({ error: 'No entries found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    
    // Return JSON format
    if (isJson) {
      const jsonResponse = {
        metadata: {
          key: source.key,
          name: source.name,
          generated_at: new Date().toISOString(),
          entries_count: entries.length,
          last_sync_at: source.last_sync_at,
        },
        entries: entries.map((e, i) => ({
          id: i + 1,
          title: e.title,
          url: e.stream_url,
          group: e.group_title,
          logo: e.tvg_logo,
          tvg_id: e.tvg_id,
          tvg_name: e.tvg_name,
          language: e.tvg_language,
          duration: e.duration,
        })),
      };
      
      return new Response(JSON.stringify(jsonResponse, null, 2), {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
          'Content-Disposition': `attachment; filename="${key}.json"`,
          'X-Entries-Count': entries.length.toString(),
          'X-Generated-At': new Date().toISOString(),
        },
      });
    }
    
    // Generate M3U content
    let m3uContent = '#EXTM3U\n';
    m3uContent += `#EXTM3U x-tvg-url="" url-tvg=""\n`;
    
    for (const entry of entries) {
      const attrs: string[] = [];
      if (entry.tvg_id) attrs.push(`tvg-id="${entry.tvg_id}"`);
      if (entry.tvg_name) attrs.push(`tvg-name="${entry.tvg_name}"`);
      if (entry.tvg_logo) attrs.push(`tvg-logo="${entry.tvg_logo}"`);
      if (entry.tvg_language) attrs.push(`tvg-language="${entry.tvg_language}"`);
      if (entry.group_title) attrs.push(`group-title="${entry.group_title}"`);
      
      const attrStr = attrs.length > 0 ? ' ' + attrs.join(' ') : '';
      m3uContent += `#EXTINF:${entry.duration || -1}${attrStr},${entry.title}\n`;
      m3uContent += `${entry.stream_url}\n`;
    }
    
    // Return gzipped content
    if (isGzip) {
      const encoder = new TextEncoder();
      const data = encoder.encode(m3uContent);
      
      // Use CompressionStream for gzip
      const cs = new CompressionStream('gzip');
      const writer = cs.writable.getWriter();
      writer.write(data);
      writer.close();
      
      const compressedStream = cs.readable;
      const reader = compressedStream.getReader();
      const chunks: Uint8Array[] = [];
      
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
      }
      
      const compressedData = new Uint8Array(chunks.reduce((acc, chunk) => acc + chunk.length, 0));
      let offset = 0;
      for (const chunk of chunks) {
        compressedData.set(chunk, offset);
        offset += chunk.length;
      }
      
      return new Response(compressedData, {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/gzip',
          'Content-Disposition': `attachment; filename="${key}.m3u.gz"`,
          'Content-Encoding': 'gzip',
          'X-Entries-Count': entries.length.toString(),
          'X-Generated-At': new Date().toISOString(),
        },
      });
    }
    
    // Return plain M3U
    return new Response(m3uContent, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'audio/x-mpegurl; charset=utf-8',
        'Content-Disposition': `attachment; filename="${key}.m3u"`,
        'X-Entries-Count': entries.length.toString(),
        'X-Generated-At': new Date().toISOString(),
      },
    });
    
  } catch (error: any) {
    console.error('[M3U-Playlist] Error:', error);
    return new Response(JSON.stringify({
      error: error.message || 'Internal server error',
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
