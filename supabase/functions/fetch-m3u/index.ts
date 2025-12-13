import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// For large playlists, we process in streaming mode and save directly to DB
// For small playlists (<5MB), we return the content directly
const STREAMING_THRESHOLD = 5 * 1024 * 1024; // 5MB

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { url, sourceId, sourceName } = await req.json();

    if (!url) {
      return new Response(
        JSON.stringify({ error: "URL is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("[fetch-m3u] Fetching M3U from:", url);

    // Normalize URL - force HTTP for common Xtream ports
    let fetchUrl = url;
    try {
      const urlObj = new URL(url);
      const httpPorts = ['8880', '8000', '25461', '25462', '8080'];
      if (urlObj.protocol === 'https:' && httpPorts.includes(urlObj.port)) {
        fetchUrl = url.replace('https://', 'http://');
        console.log("[fetch-m3u] Using HTTP for port:", urlObj.port);
      }
    } catch (e) {
      console.log("[fetch-m3u] URL parse warning:", e.message);
    }

    const response = await fetch(fetchUrl, {
      method: 'GET',
      headers: {
        "User-Agent": "VLC/3.0.18 LibVLC/3.0.18",
        "Accept": "*/*",
      },
    });

    console.log("[fetch-m3u] Response status:", response.status);

    if (!response.ok) {
      if (response.status === 404 || response.status === 403) {
        throw new Error("Servidor bloqueou a requisição. Use 'Colar M3U' para importar.");
      }
      throw new Error(`HTTP ${response.status}`);
    }

    // Check content-length to decide processing mode
    const contentLength = response.headers.get('content-length');
    const estimatedSize = contentLength ? parseInt(contentLength) : 0;
    
    console.log("[fetch-m3u] Estimated size:", Math.round(estimatedSize / 1024 / 1024), "MB");

    // For large files, process in streaming mode and save directly to DB
    if (estimatedSize > STREAMING_THRESHOLD || !contentLength) {
      console.log("[fetch-m3u] Large file detected, using streaming mode");
      
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
      const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
      const supabase = createClient(supabaseUrl, supabaseKey);

      // Create or get source
      let actualSourceId = sourceId;
      if (!actualSourceId) {
        const { data: source, error: sourceError } = await supabase
          .from('m3u_sources')
          .insert({
            name: sourceName || `Imported ${new Date().toISOString()}`,
            url: url,
            source_type: 'url',
            sync_status: 'syncing'
          })
          .select()
          .single();
        
        if (sourceError) throw new Error(`Failed to create source: ${sourceError.message}`);
        actualSourceId = source.id;
      } else {
        await supabase
          .from('m3u_sources')
          .update({ sync_status: 'syncing', last_sync_at: new Date().toISOString() })
          .eq('id', actualSourceId);
      }

      // Process stream line by line
      const reader = response.body?.getReader();
      if (!reader) throw new Error("Não foi possível ler a resposta");

      const decoder = new TextDecoder();
      let buffer = '';
      let currentEntry: any = null;
      let entries: any[] = [];
      let totalEntries = 0;
      const BATCH_SIZE = 500;

      const flushEntries = async () => {
        if (entries.length === 0) return;
        
        const { error } = await supabase
          .from('m3u_sync_entries')
          .upsert(entries, { onConflict: 'source_id,stream_url' });
        
        if (error) {
          console.error("[fetch-m3u] Batch insert error:", error.message);
        } else {
          totalEntries += entries.length;
          console.log(`[fetch-m3u] Inserted batch: ${entries.length} entries (total: ${totalEntries})`);
        }
        entries = [];
      };

      while (true) {
        const { done, value } = await reader.read();
        
        if (done) {
          // Process remaining buffer
          if (buffer.trim()) {
            const lines = buffer.split('\n');
            for (const line of lines) {
              processLine(line.trim(), currentEntry, entries, actualSourceId);
            }
          }
          await flushEntries();
          break;
        }

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        
        // Keep the last incomplete line in buffer
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmedLine = line.trim();
          if (!trimmedLine) continue;

          if (trimmedLine.startsWith('#EXTINF:')) {
            // Parse EXTINF line
            currentEntry = parseExtinfLine(trimmedLine);
            currentEntry.source_id = actualSourceId;
          } else if (trimmedLine.startsWith('#')) {
            // Skip other directives
            continue;
          } else if (currentEntry && (trimmedLine.startsWith('http://') || trimmedLine.startsWith('https://'))) {
            // This is the stream URL
            currentEntry.stream_url = trimmedLine;
            entries.push(currentEntry);
            currentEntry = null;

            if (entries.length >= BATCH_SIZE) {
              await flushEntries();
            }
          }
        }
      }

      // Update source status
      await supabase
        .from('m3u_sources')
        .update({ 
          sync_status: 'completed', 
          entry_count: totalEntries,
          last_sync_at: new Date().toISOString()
        })
        .eq('id', actualSourceId);

      console.log(`[fetch-m3u] Streaming complete: ${totalEntries} entries saved`);

      return new Response(
        JSON.stringify({ 
          success: true, 
          mode: 'streaming',
          sourceId: actualSourceId,
          entryCount: totalEntries,
          message: `Importados ${totalEntries} canais com sucesso`
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // For small files, return content directly (original behavior)
    console.log("[fetch-m3u] Small file, returning content directly");
    
    const content = await response.text();
    console.log("[fetch-m3u] Content length:", content.length, "chars");

    if (!content.includes('#EXTM3U') && !content.includes('#EXTINF')) {
      throw new Error("Conteúdo não parece ser M3U válido");
    }

    return new Response(
      JSON.stringify({ content, mode: 'direct' }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[fetch-m3u] Error:", error.message);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

function parseExtinfLine(line: string): any {
  const entry: any = {
    title: 'Unknown',
    tvg_id: null,
    tvg_name: null,
    tvg_logo: null,
    group_title: null,
    stream_type: 'live',
    is_active: true
  };

  // Extract attributes
  const tvgIdMatch = line.match(/tvg-id="([^"]*)"/i);
  const tvgNameMatch = line.match(/tvg-name="([^"]*)"/i);
  const tvgLogoMatch = line.match(/tvg-logo="([^"]*)"/i);
  const groupMatch = line.match(/group-title="([^"]*)"/i);

  if (tvgIdMatch) entry.tvg_id = tvgIdMatch[1];
  if (tvgNameMatch) entry.tvg_name = tvgNameMatch[1];
  if (tvgLogoMatch) entry.tvg_logo = tvgLogoMatch[1];
  if (groupMatch) entry.group_title = groupMatch[1];

  // Extract title (after the last comma)
  const commaIndex = line.lastIndexOf(',');
  if (commaIndex !== -1) {
    entry.title = line.substring(commaIndex + 1).trim() || entry.tvg_name || 'Unknown';
  }

  // Detect stream type from group
  const group = (entry.group_title || '').toLowerCase();
  if (group.includes('vod') || group.includes('filme') || group.includes('movie') || group.includes('série') || group.includes('series')) {
    entry.stream_type = 'vod';
  }

  return entry;
}

function processLine(line: string, currentEntry: any, entries: any[], sourceId: string) {
  if (!line) return;
  
  if (line.startsWith('#EXTINF:')) {
    return parseExtinfLine(line);
  } else if (!line.startsWith('#') && currentEntry && (line.startsWith('http://') || line.startsWith('https://'))) {
    currentEntry.stream_url = line;
    entries.push(currentEntry);
    return null;
  }
  return currentEntry;
}
