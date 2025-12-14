/**
 * Fetch M3U - Enterprise IPTV Import Pipeline
 * 
 * Features:
 * - Streaming parse for large files (no memory issues)
 * - Canonical normalization (lowercase, no accents, no special chars)
 * - Anti-duplication via source_hash
 * - Pre-indexing of series (Series > Season > Episode)
 * - Automatic category creation/linking
 * - SSE progress updates
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const DB_BATCH_SIZE = 100;

interface ParsedChannel {
  name: string;
  url: string;
  logo?: string;
  group?: string;
  tvgId?: string;
  tvgName?: string;
}

interface ProcessedChannel {
  name: string;
  normalized_name: string;
  slug: string;
  original_url: string;
  logo_url: string | null;
  category: string | null;
  normalized_category: string | null;
  content_type: string;
  source_hash: string;
  is_healthy: boolean;
  health_score: number;
  transcode_status: string;
  shard_id: number;
  metadata: Record<string, unknown>;
  // Series fields
  series_name: string | null;
  series_key: string | null;
  season_number: number | null;
  episode_number: number | null;
  episode_title: string | null;
  is_series: boolean;
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

    if (content) {
      return await processM3UContent(content, stream, supabase, req.signal);
    }

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
        return await processStreamingResponse(httpResponse, stream, supabase, req.signal);
      } else {
        throw new Error(`Failed to fetch M3U: HTTP ${response.status}`);
      }
    }

    return await processStreamingResponse(response, stream, supabase, req.signal);

  } catch (error: any) {
    console.error("[fetch-m3u] Error:", error.message);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

// ==================== TEXT NORMALIZATION ====================

function normalizeText(input: string | null): string | null {
  if (!input) return null;
  return input
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove accents
    .replace(/[^a-z0-9 ]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function generateSourceHash(url: string, name: string, category: string | null): string {
  const normalized = `${url}|${normalizeText(name) || ''}|${normalizeText(category) || ''}`;
  // Simple hash using built-in crypto
  let hash = 0;
  for (let i = 0; i < normalized.length; i++) {
    const char = normalized.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(16).padStart(8, '0');
}

// ==================== SERIES DETECTION ====================

interface SeriesInfo {
  seriesKey: string | null;
  seriesName: string | null;
  seasonNumber: number;
  episodeNumber: number;
  episodeTitle: string;
  isSeries: boolean;
}

function extractSeriesInfo(channelName: string, category: string | null): SeriesInfo {
  const result: SeriesInfo = {
    seriesKey: null,
    seriesName: null,
    seasonNumber: 0,
    episodeNumber: 0,
    episodeTitle: '',
    isSeries: false,
  };

  // Skip movie/live categories
  const catLower = (category || '').toLowerCase();
  const moviePatterns = ['filme', 'filmes', 'movie', 'movies', 'cinema', 'lançamento', 'lancamento'];
  const livePatterns = ['aberto', '24h', 'canais', 'canal', 'ao vivo', 'live', 'esporte', 'futebol', 'news', 'fhd', 'premiere', 'ppv', 'combate', 'ufc', 'adulto', 'adult', 'xxx', '18+'];
  
  if (moviePatterns.some(p => catLower.includes(p)) || livePatterns.some(p => catLower.includes(p))) {
    return result;
  }

  // Pattern 1: S01E01, S1E1
  let match = channelName.match(/(.+?)\s*[Ss](\d{1,2})\s*[Ee](\d{1,3})\s*[-:.]?\s*(.*)/i);
  if (match) {
    result.seriesName = match[1].trim().replace(/[-_.:]+$/, '').trim();
    result.seasonNumber = parseInt(match[2]);
    result.episodeNumber = parseInt(match[3]);
    result.episodeTitle = match[4].trim();
    result.isSeries = true;
  }

  // Pattern 2: 1x01
  if (!result.isSeries) {
    match = channelName.match(/(.+?)\s*(\d{1,2})[xX](\d{1,3})\s*[-:.]?\s*(.*)/i);
    if (match) {
      result.seriesName = match[1].trim().replace(/[-_.:]+$/, '').trim();
      result.seasonNumber = parseInt(match[2]);
      result.episodeNumber = parseInt(match[3]);
      result.episodeTitle = match[4].trim();
      result.isSeries = true;
    }
  }

  // Pattern 3: Temporada X Episodio Y
  if (!result.isSeries) {
    match = channelName.match(/(.+?)\s*[Tt]emporada\s*(\d{1,2}).*[Ee]pis[oó]dio\s*(\d{1,3})\s*[-:.]?\s*(.*)/i);
    if (match) {
      result.seriesName = match[1].trim().replace(/[-_.:]+$/, '').trim();
      result.seasonNumber = parseInt(match[2]);
      result.episodeNumber = parseInt(match[3]);
      result.episodeTitle = match[4].trim();
      result.isSeries = true;
    }
  }

  // Pattern 4: EP01, E01
  if (!result.isSeries) {
    match = channelName.match(/(.+?)\s*[Ee][Pp]?\s*(\d{1,3})(?:\s|$|-|\.)/i);
    if (match && match[1].length > 2) {
      result.seriesName = match[1].trim().replace(/[-_.:]+$/, '').trim();
      result.seasonNumber = 1;
      result.episodeNumber = parseInt(match[2]);
      result.isSeries = true;
    }
  }

  if (result.isSeries && result.seriesName) {
    result.seriesKey = normalizeText(result.seriesName);
  }

  return result;
}

// ==================== CHANNEL PROCESSING ====================

function processChannel(ch: ParsedChannel): ProcessedChannel {
  const seriesInfo = extractSeriesInfo(ch.name, ch.group);
  const normalizedName = normalizeText(ch.name);
  const normalizedCategory = normalizeText(ch.group);
  const sourceHash = generateSourceHash(ch.url, ch.name, ch.group);

  // Generate display name for series
  let displayName = ch.name;
  if (seriesInfo.isSeries && seriesInfo.seriesName) {
    displayName = `${seriesInfo.seriesName} | T${seriesInfo.seasonNumber || 1} - E${seriesInfo.episodeNumber || 1}`;
  }

  return {
    name: displayName,
    normalized_name: normalizedName || '',
    slug: generateSlug(ch.name),
    original_url: ch.url,
    logo_url: ch.logo || null,
    category: ch.group || null,
    normalized_category: normalizedCategory,
    content_type: detectContentType(ch.url, ch.group),
    source_hash: sourceHash,
    is_healthy: true,
    health_score: 100,
    transcode_status: 'none',
    shard_id: 0,
    metadata: { tvg_id: ch.tvgId || null, tvg_name: ch.tvgName || null },
    series_name: seriesInfo.seriesName,
    series_key: seriesInfo.seriesKey,
    season_number: seriesInfo.seasonNumber || null,
    episode_number: seriesInfo.episodeNumber || null,
    episode_title: seriesInfo.episodeTitle || null,
    is_series: seriesInfo.isSeries,
  };
}

// ==================== STREAMING PROCESSOR ====================

async function processStreamingResponse(response: Response, stream: boolean, supabase: any, abortSignal: AbortSignal): Promise<Response> {
  const reader = response.body?.getReader();
  if (!reader) throw new Error("No response body");

  const decoder = new TextDecoder();
  let buffer = '';
  let currentChannel: Partial<ParsedChannel> = {};
  let batch: ParsedChannel[] = [];
  let totalParsed = 0;
  let inserted = 0;
  let skipped = 0;
  let duplicates = 0;

  if (stream) {
    const encoder = new TextEncoder();
    const body = new ReadableStream({
      async start(controller) {
        const send = (data: object) => {
          try {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
          } catch (e) {}
        };

        send({ type: 'start', total: 0, message: 'Iniciando pipeline enterprise...' });

        try {
          while (true) {
            // Stop if client aborted
            if (abortSignal.aborted) {
              console.log('[fetch-m3u] Abort detected during streaming parse');
              await reader.cancel();
              controller.close();
              return;
            }

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
                    const result = await insertBatchEnterprise(supabase, batch);
                    inserted += result.inserted;
                    skipped += result.skipped;
                    duplicates += result.duplicates;
                    batch = [];

                    send({ 
                      type: 'progress', 
                      processed: totalParsed, 
                      total: totalParsed, 
                      progress: 0,
                      inserted, 
                      skipped,
                      duplicates,
                      message: `Processando... ${totalParsed} canais (${duplicates} duplicados ignorados)`
                    });
                  }
                }
                currentChannel = {};
              }
            }
          }

          // Process remaining
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

          if (batch.length > 0) {
            const result = await insertBatchEnterprise(supabase, batch);
            inserted += result.inserted;
            skipped += result.skipped;
            duplicates += result.duplicates;
          }

          // Post-processing: Update categories table
          await updateCategoriesTable(supabase);

          console.log(`[fetch-m3u] Complete: ${totalParsed} parsed, ${inserted} inserted, ${duplicates} duplicates, ${skipped} skipped`);
          send({ 
            type: 'complete', 
            inserted, 
            skipped, 
            duplicates,
            total: totalParsed, 
            message: `Importados ${inserted} canais (${duplicates} duplicados ignorados)` 
          });
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
    if (abortSignal.aborted) {
      console.log('[fetch-m3u] Abort detected during non-streaming parse');
      await reader.cancel();
      break;
    }

    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

  for (const line of lines) {
    if (abortSignal.aborted) {
      console.log('[fetch-m3u] Abort detected during parseAndImportM3U');
      break;
    }

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
            const result = await insertBatchEnterprise(supabase, batch);
            inserted += result.inserted;
            skipped += result.skipped;
            duplicates += result.duplicates;
            batch = [];
          }
        }
        currentChannel = {};
      }
    }
  }

  if (batch.length > 0) {
    const result = await insertBatchEnterprise(supabase, batch);
    inserted += result.inserted;
    skipped += result.skipped;
    duplicates += result.duplicates;
  }

  await updateCategoriesTable(supabase);

  console.log(`[fetch-m3u] Complete: ${totalParsed} parsed, ${inserted} inserted, ${duplicates} duplicates, ${skipped} skipped`);

  return new Response(
    JSON.stringify({ 
      success: true, 
      inserted, 
      skipped, 
      duplicates,
      total: totalParsed,
      message: `Importados ${inserted} canais (${duplicates} duplicados ignorados)`
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
  let duplicates = 0;

  if (stream) {
    const encoder = new TextEncoder();
    const body = new ReadableStream({
      async start(controller) {
        const send = (data: object) => {
          try {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
          } catch (e) {}
        };

        send({ type: 'start', total: lines.length, message: 'Iniciando pipeline enterprise...' });

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
                const result = await insertBatchEnterprise(supabase, batch);
                inserted += result.inserted;
                skipped += result.skipped;
                duplicates += result.duplicates;
                batch = [];

                send({ 
                  type: 'progress', 
                  processed: totalParsed, 
                  total: totalParsed,
                  progress: 0,
                  inserted, 
                  skipped,
                  duplicates,
                  message: `Processando... ${totalParsed} canais`
                });
              }
            }
            currentChannel = {};
          }
        }

        if (batch.length > 0) {
          const result = await insertBatchEnterprise(supabase, batch);
          inserted += result.inserted;
          skipped += result.skipped;
          duplicates += result.duplicates;
        }

        await updateCategoriesTable(supabase);

        send({ 
          type: 'complete', 
          inserted, 
          skipped, 
          duplicates,
          total: totalParsed, 
          message: `Importados ${inserted} canais (${duplicates} duplicados)` 
        });
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
          const result = await insertBatchEnterprise(supabase, batch);
          inserted += result.inserted;
          skipped += result.skipped;
          duplicates += result.duplicates;
          batch = [];
        }
      }
      currentChannel = {};
    }
  }

  if (batch.length > 0) {
    const result = await insertBatchEnterprise(supabase, batch);
    inserted += result.inserted;
    skipped += result.skipped;
    duplicates += result.duplicates;
  }

  await updateCategoriesTable(supabase);

  return new Response(
    JSON.stringify({ 
      success: true, 
      inserted, 
      skipped, 
      duplicates,
      total: totalParsed,
      message: `Importados ${inserted} canais (${duplicates} duplicados ignorados)`
    }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}

// ==================== BATCH INSERT (ENTERPRISE) ====================

async function insertBatchEnterprise(supabase: any, channels: ParsedChannel[]): Promise<{ inserted: number; skipped: number; duplicates: number }> {
  // Process all channels with normalization and series detection
  const records = channels.map(ch => processChannel(ch));

  // De-duplicate inside this batch by original_url only (DB has unique constraint on original_url)
  const uniqueByUrlMap = new Map<string, typeof records[0]>();
  for (const rec of records) {
    if (!uniqueByUrlMap.has(rec.original_url)) {
      uniqueByUrlMap.set(rec.original_url, rec);
    }
  }
  const newRecords = Array.from(uniqueByUrlMap.values());
  const duplicateCount = records.length - newRecords.length;

  if (newRecords.length === 0) {
    return { inserted: 0, skipped: 0, duplicates: duplicateCount };
  }

  // Remove fields that don't exist as columns in iptv_channels (like normalized_category)
  const sanitizedRecords = newRecords.map(({ normalized_category, ...rest }) => rest);

  // Use upsert with original_url conflict handling to avoid unique constraint errors
  const { data: upsertData, error } = await supabase
    .from('iptv_channels')
    .upsert(sanitizedRecords, {
      onConflict: 'original_url',
      ignoreDuplicates: true
    })
    .select('id, category');

  if (error) {
    console.error('[fetch-m3u] Batch error:', error.message);
    // Try inserting one by one to get as many as possible
    let insertedCount = 0;
    const insertedChannels: Array<{ id: number; category: string | null }> = [];
    
    for (const record of sanitizedRecords) {
      const { data: singleData, error: singleError } = await supabase
        .from('iptv_channels')
        .upsert(record, {
          onConflict: 'original_url',
          ignoreDuplicates: true
        })
        .select('id, category')
        .single();
      
      if (!singleError && singleData) {
        insertedCount++;
        insertedChannels.push(singleData);
      }
    }

    if (insertedChannels.length > 0) {
      await autoAssociateToPlaylists(supabase, insertedChannels);
    }

    return { inserted: insertedCount, skipped: sanitizedRecords.length - insertedCount, duplicates: duplicateCount };
  }

  const insertedCount = upsertData?.length || 0;

  // Auto-associate to playlists
  if (upsertData && upsertData.length > 0) {
    await autoAssociateToPlaylists(supabase, upsertData);
  }

  return { inserted: insertedCount, skipped: 0, duplicates: duplicateCount };
}

// ==================== CATEGORY TABLE UPDATE ====================

async function updateCategoriesTable(supabase: any) {
  try {
    // Get all unique categories from channels
    const { data: categories } = await supabase
      .from('iptv_channels')
      .select('category')
      .not('category', 'is', null);

    if (!categories || categories.length === 0) return;

    const uniqueCategories = [...new Set(categories.map((c: any) => c.category).filter(Boolean))];

    for (const cat of uniqueCategories) {
      const normalizedName = normalizeText(cat as string);
      if (!normalizedName) continue;

      // Upsert category
      await supabase
        .from('iptv_categories')
        .upsert({
          normalized_name: normalizedName,
          display_name: cat,
        }, {
          onConflict: 'normalized_name',
          ignoreDuplicates: true,
        });
    }

    // Update channel_count for all categories
    const { data: catData } = await supabase.from('iptv_categories').select('id, normalized_name, display_name');
    
    for (const category of (catData || [])) {
      const { count } = await supabase
        .from('iptv_channels')
        .select('*', { count: 'exact', head: true })
        .eq('category', category.display_name);

      await supabase
        .from('iptv_categories')
        .update({ channel_count: count || 0 })
        .eq('id', category.id);
    }

    console.log(`[fetch-m3u] Updated ${uniqueCategories.length} categories in iptv_categories table`);
  } catch (err: any) {
    console.warn('[fetch-m3u] Category table update warning:', err.message);
  }
}

// ==================== PLAYLIST AUTO-ASSOCIATION ====================

async function autoAssociateToPlaylists(supabase: any, channels: Array<{ id: number; category: string | null }>) {
  const categories = [...new Set(channels.filter(c => c.category).map(c => c.category!))];
  
  if (categories.length === 0) return;

  const { data: playlists } = await supabase
    .from('iptv_playlists')
    .select('id, name');

  if (!playlists || playlists.length === 0) return;

  const playlistMap = new Map<string, number>();
  for (const p of playlists) {
    playlistMap.set(p.name.toLowerCase().trim(), p.id);
  }

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
    for (let i = 0; i < associations.length; i += 500) {
      const batch = associations.slice(i, i + 500);
      await supabase
        .from('iptv_playlist_channels')
        .upsert(batch, {
          onConflict: 'playlist_id,channel_id',
          ignoreDuplicates: true
        });
    }

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
  }
}

// ==================== UTILITIES ====================

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
  if (g.includes('série') || g.includes('series') || g.includes('anime')) return 'series';
  return 'live';
}
