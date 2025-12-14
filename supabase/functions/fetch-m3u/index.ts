/**
 * Fetch M3U - Unified Import to iptv_channels with Streaming Parse
 * 
 * Usa streaming para processar arquivos grandes sem estourar memória.
 * Parseia linha por linha e insere em batches conforme processa.
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const DB_BATCH_SIZE = 500;

interface ParsedChannel {
  name: string;
  url: string;
  logo?: string;
  group?: string;
  tvgId?: string;
  tvgName?: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    const { url, content, stream } = await req.json();

    if (!url && !content) {
      throw new Error("URL ou conteúdo M3U é obrigatório");
    }

    // If content is provided directly, use line-by-line processing
    if (content) {
      return await processM3UContent(content, stream, supabase);
    }

    // Fetch from URL with streaming
    console.log("[fetch-m3u] Fetching from URL:", url.substring(0, 80));
    
    let fetchUrl = url;
    try {
      const urlObj = new URL(url);
      const httpPorts = ['8880', '8000', '25461', '25462', '8080'];
      if (urlObj.protocol === 'https:' && httpPorts.includes(urlObj.port)) {
        fetchUrl = url.replace('https://', 'http://');
      }
    } catch {}

    const response = await fetch(fetchUrl, {
      method: 'GET',
      headers: {
        "User-Agent": "VLC/3.0.18 LibVLC/3.0.18",
        "Accept": "*/*",
      },
    });

    if (!response.ok) {
      if (fetchUrl.startsWith('https://')) {
        const httpUrl = fetchUrl.replace('https://', 'http://');
        const httpResponse = await fetch(httpUrl, {
          method: 'GET',
          headers: { "User-Agent": "VLC/3.0.18 LibVLC/3.0.18", "Accept": "*/*" },
        });
        if (!httpResponse.ok) throw new Error(`Failed to fetch M3U: HTTP ${httpResponse.status}`);
        return await processStreamingResponse(httpResponse, stream, supabase);
      } else {
        throw new Error(`Failed to fetch M3U: HTTP ${response.status}`);
      }
    }

    return await processStreamingResponse(response, stream, supabase);

  } catch (error: any) {
    console.error("[fetch-m3u] Error:", error.message);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

async function processStreamingResponse(response: Response, stream: boolean, supabase: any): Promise<Response> {
  const reader = response.body?.getReader();
  if (!reader) throw new Error("No response body");

  const decoder = new TextDecoder();
  let buffer = '';
  let currentChannel: Partial<ParsedChannel> = {};
  let batch: ParsedChannel[] = [];
  let totalParsed = 0;
  let inserted = 0;
  let skipped = 0;

  // For SSE streaming
  if (stream) {
    const encoder = new TextEncoder();
    const body = new ReadableStream({
      async start(controller) {
        const send = (data: object) => {
          try {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
          } catch (e) {
            // Controller may be closed
          }
        };

        send({ type: 'start', total: 0, message: 'Iniciando processamento...' });

        try {
          while (true) {
            const { done, value } = await reader.read();
            
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || ''; // Keep incomplete line in buffer

            for (const line of lines) {
              const trimmed = line.trim();
              
              if (trimmed.startsWith('#EXTINF:')) {
                const logoMatch = trimmed.match(/tvg-logo="([^"]+)"/i);
                const groupMatch = trimmed.match(/group-title="([^"]+)"/i);
                const tvgIdMatch = trimmed.match(/tvg-id="([^"]+)"/i);
                const tvgNameMatch = trimmed.match(/tvg-name="([^"]+)"/i);
                const nameMatch = trimmed.match(/,(.+)$/);
                currentChannel = {
                  logo: logoMatch?.[1],
                  group: groupMatch?.[1],
                  tvgId: tvgIdMatch?.[1],
                  tvgName: tvgNameMatch?.[1],
                  name: nameMatch?.[1]?.trim() || 'Unknown',
                };
              } else if (trimmed && !trimmed.startsWith('#') && currentChannel.name) {
                if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
                  currentChannel.url = trimmed;
                  batch.push(currentChannel as ParsedChannel);
                  totalParsed++;

                  // Process batch when full
                  if (batch.length >= DB_BATCH_SIZE) {
                    const result = await insertBatch(supabase, batch);
                    inserted += result.inserted;
                    skipped += result.skipped;
                    batch = [];

                    send({ 
                      type: 'progress', 
                      processed: totalParsed, 
                      total: totalParsed, 
                      progress: 0, // Unknown total
                      inserted, 
                      skipped,
                      message: `Processando... ${totalParsed} canais encontrados`
                    });
                  }
                }
                currentChannel = {};
              }
            }
          }

          // Process remaining buffer
          if (buffer.trim()) {
            const trimmed = buffer.trim();
            if (trimmed && !trimmed.startsWith('#') && currentChannel.name) {
              if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
                currentChannel.url = trimmed;
                batch.push(currentChannel as ParsedChannel);
                totalParsed++;
              }
            }
          }

          // Final batch
          if (batch.length > 0) {
            const result = await insertBatch(supabase, batch);
            inserted += result.inserted;
            skipped += result.skipped;
          }

          console.log(`[fetch-m3u] Complete: ${totalParsed} parsed, ${inserted} inserted, ${skipped} skipped`);
          send({ type: 'complete', inserted, skipped, total: totalParsed, message: `Importados ${inserted} canais` });
          controller.close();

        } catch (err: any) {
          console.error('[fetch-m3u] Stream error:', err.message);
          send({ type: 'error', error: err.message });
          controller.close();
        }
      }
    });

    return new Response(body, {
      headers: {
        ...corsHeaders,
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
      },
    });
  }

  // Non-streaming mode
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      const trimmed = line.trim();
      
      if (trimmed.startsWith('#EXTINF:')) {
        const logoMatch = trimmed.match(/tvg-logo="([^"]+)"/i);
        const groupMatch = trimmed.match(/group-title="([^"]+)"/i);
        const tvgIdMatch = trimmed.match(/tvg-id="([^"]+)"/i);
        const tvgNameMatch = trimmed.match(/tvg-name="([^"]+)"/i);
        const nameMatch = trimmed.match(/,(.+)$/);
        currentChannel = {
          logo: logoMatch?.[1],
          group: groupMatch?.[1],
          tvgId: tvgIdMatch?.[1],
          tvgName: tvgNameMatch?.[1],
          name: nameMatch?.[1]?.trim() || 'Unknown',
        };
      } else if (trimmed && !trimmed.startsWith('#') && currentChannel.name) {
        if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
          currentChannel.url = trimmed;
          batch.push(currentChannel as ParsedChannel);
          totalParsed++;

          if (batch.length >= DB_BATCH_SIZE) {
            const result = await insertBatch(supabase, batch);
            inserted += result.inserted;
            skipped += result.skipped;
            batch = [];
          }
        }
        currentChannel = {};
      }
    }
  }

  // Final batch
  if (batch.length > 0) {
    const result = await insertBatch(supabase, batch);
    inserted += result.inserted;
    skipped += result.skipped;
  }

  console.log(`[fetch-m3u] Complete: ${totalParsed} parsed, ${inserted} inserted, ${skipped} skipped`);

  return new Response(
    JSON.stringify({ 
      success: true, inserted, skipped, total: totalParsed,
      message: `Importados ${inserted} canais${skipped > 0 ? ` (${skipped} duplicados)` : ''}`
    }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}

async function processM3UContent(content: string, stream: boolean, supabase: any): Promise<Response> {
  const lines = content.split('\n');
  let currentChannel: Partial<ParsedChannel> = {};
  let batch: ParsedChannel[] = [];
  let totalParsed = 0;
  let inserted = 0;
  let skipped = 0;

  if (stream) {
    const encoder = new TextEncoder();
    const body = new ReadableStream({
      async start(controller) {
        const send = (data: object) => {
          try {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
          } catch (e) {}
        };

        send({ type: 'start', total: lines.length });

        for (const line of lines) {
          const trimmed = line.trim();
          
          if (trimmed.startsWith('#EXTINF:')) {
            const logoMatch = trimmed.match(/tvg-logo="([^"]+)"/i);
            const groupMatch = trimmed.match(/group-title="([^"]+)"/i);
            const tvgIdMatch = trimmed.match(/tvg-id="([^"]+)"/i);
            const tvgNameMatch = trimmed.match(/tvg-name="([^"]+)"/i);
            const nameMatch = trimmed.match(/,(.+)$/);
            currentChannel = {
              logo: logoMatch?.[1],
              group: groupMatch?.[1],
              tvgId: tvgIdMatch?.[1],
              tvgName: tvgNameMatch?.[1],
              name: nameMatch?.[1]?.trim() || 'Unknown',
            };
          } else if (trimmed && !trimmed.startsWith('#') && currentChannel.name) {
            if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
              currentChannel.url = trimmed;
              batch.push(currentChannel as ParsedChannel);
              totalParsed++;

              if (batch.length >= DB_BATCH_SIZE) {
                const result = await insertBatch(supabase, batch);
                inserted += result.inserted;
                skipped += result.skipped;
                batch = [];

                send({ 
                  type: 'progress', 
                  processed: totalParsed, 
                  total: totalParsed,
                  progress: 0,
                  inserted, 
                  skipped 
                });
              }
            }
            currentChannel = {};
          }
        }

        if (batch.length > 0) {
          const result = await insertBatch(supabase, batch);
          inserted += result.inserted;
          skipped += result.skipped;
        }

        send({ type: 'complete', inserted, skipped, total: totalParsed, message: `Importados ${inserted} canais` });
        controller.close();
      }
    });

    return new Response(body, {
      headers: {
        ...corsHeaders,
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
      },
    });
  }

  // Non-streaming
  for (const line of lines) {
    const trimmed = line.trim();
    
    if (trimmed.startsWith('#EXTINF:')) {
      const logoMatch = trimmed.match(/tvg-logo="([^"]+)"/i);
      const groupMatch = trimmed.match(/group-title="([^"]+)"/i);
      const tvgIdMatch = trimmed.match(/tvg-id="([^"]+)"/i);
      const tvgNameMatch = trimmed.match(/tvg-name="([^"]+)"/i);
      const nameMatch = trimmed.match(/,(.+)$/);
      currentChannel = {
        logo: logoMatch?.[1],
        group: groupMatch?.[1],
        tvgId: tvgIdMatch?.[1],
        tvgName: tvgNameMatch?.[1],
        name: nameMatch?.[1]?.trim() || 'Unknown',
      };
    } else if (trimmed && !trimmed.startsWith('#') && currentChannel.name) {
      if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
        currentChannel.url = trimmed;
        batch.push(currentChannel as ParsedChannel);
        totalParsed++;

        if (batch.length >= DB_BATCH_SIZE) {
          const result = await insertBatch(supabase, batch);
          inserted += result.inserted;
          skipped += result.skipped;
          batch = [];
        }
      }
      currentChannel = {};
    }
  }

  if (batch.length > 0) {
    const result = await insertBatch(supabase, batch);
    inserted += result.inserted;
    skipped += result.skipped;
  }

  return new Response(
    JSON.stringify({ 
      success: true, inserted, skipped, total: totalParsed,
      message: `Importados ${inserted} canais${skipped > 0 ? ` (${skipped} duplicados)` : ''}`
    }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}

async function insertBatch(supabase: any, channels: ParsedChannel[]): Promise<{ inserted: number; skipped: number }> {
  const records = channels.map(ch => ({
    name: ch.name,
    slug: generateSlug(ch.name),
    original_url: ch.url,
    logo_url: ch.logo || null,
    category: ch.group || null,
    content_type: detectContentType(ch.url, ch.group),
    is_healthy: true,
    health_score: 100,
    transcode_status: 'none',
    shard_id: 0,
    metadata: { tvg_id: ch.tvgId || null, tvg_name: ch.tvgName || null }
  }));

  const { data: upsertData, error } = await supabase
    .from('iptv_channels')
    .upsert(records, { 
      onConflict: 'original_url',
      ignoreDuplicates: true
    })
    .select('id, category');

  if (error) {
    console.error('[fetch-m3u] Batch error:', error.message);
    return { inserted: 0, skipped: channels.length };
  }

  const insertedCount = upsertData?.length || 0;

  // Auto-associate channels to playlists based on category name match
  if (upsertData && upsertData.length > 0) {
    await autoAssociateToPlaylists(supabase, upsertData);
  }

  return { inserted: insertedCount, skipped: channels.length - insertedCount };
}

// Auto-associate imported channels to existing playlists by matching category name
async function autoAssociateToPlaylists(supabase: any, channels: Array<{ id: number; category: string | null }>) {
  // Get unique categories from this batch
  const categories = [...new Set(channels.filter(c => c.category).map(c => c.category!))];
  
  if (categories.length === 0) return;

  console.log(`[fetch-m3u] Checking auto-association for ${categories.length} categories`);

  // Fetch all playlists to match categories
  const { data: playlists, error: playlistError } = await supabase
    .from('iptv_playlists')
    .select('id, name');

  if (playlistError || !playlists || playlists.length === 0) {
    console.log('[fetch-m3u] No playlists found for auto-association');
    return;
  }

  // Create a map of lowercase playlist names to playlist IDs
  const playlistMap = new Map<string, number>();
  for (const p of playlists) {
    playlistMap.set(p.name.toLowerCase().trim(), p.id);
  }

  console.log(`[fetch-m3u] Found ${playlists.length} playlists to match against`);

  // Group channels by their matching playlist
  const associations: Array<{ playlist_id: number; channel_id: number; position: number }> = [];
  
  for (const channel of channels) {
    if (!channel.category) continue;
    const categoryLower = channel.category.toLowerCase().trim();
    const playlistId = playlistMap.get(categoryLower);
    if (playlistId) {
      associations.push({
        playlist_id: playlistId,
        channel_id: channel.id,
        position: 0,
      });
    }
  }

  if (associations.length > 0) {
    console.log(`[fetch-m3u] Auto-associating ${associations.length} channels to playlists`);
    
    // Insert in batches to avoid payload limits
    for (let i = 0; i < associations.length; i += 500) {
      const batch = associations.slice(i, i + 500);
      const { error: assocError } = await supabase
        .from('iptv_playlist_channels')
        .upsert(batch, {
          onConflict: 'playlist_id,channel_id',
          ignoreDuplicates: true
        });

      if (assocError) {
        console.warn('[fetch-m3u] Auto-associate batch error:', assocError.message);
      }
    }

    // Update playlist channel counts
    const playlistIds = [...new Set(associations.map(a => a.playlist_id))];
    for (const plId of playlistIds) {
      const { count } = await supabase
        .from('iptv_playlist_channels')
        .select('*', { count: 'exact', head: true })
        .eq('playlist_id', plId);

      await supabase
        .from('iptv_playlists')
        .update({ channel_count: count || 0 })
        .eq('id', plId);
    }

    console.log(`[fetch-m3u] Auto-associated ${associations.length} channels to ${playlistIds.length} playlists`);
  } else {
    console.log('[fetch-m3u] No matching playlists found for imported categories');
  }
}

function generateSlug(name: string): string {
  const ts = Date.now().toString(36);
  const rand = Math.random().toString(36).substring(2, 6);
  const base = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '').substring(0, 50);
  return `${base}-${ts}-${rand}`;
}

function detectContentType(url: string, group?: string): string {
  const u = url.toLowerCase();
  const g = (group || '').toLowerCase();
  if (u.includes('/movie/') || u.includes('.mp4') || u.includes('.mkv')) return 'vod';
  if (u.includes('/series/')) return 'series';
  if (g.includes('vod') || g.includes('filme') || g.includes('movie')) return 'vod';
  if (g.includes('série') || g.includes('series')) return 'series';
  return 'live';
}
