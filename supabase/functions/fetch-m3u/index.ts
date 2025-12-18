/**
 * Fetch M3U - Enterprise IPTV Import Pipeline (Optimized for Large Files)
 * 
 * Features:
 * - Streaming parse for large files (no memory issues)
 * - CPU yield points to avoid timeout
 * - Simplified processing for better performance
 * - SSE progress updates
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Larger batch improves throughput for big playlists
const DB_BATCH_SIZE = 500;
// Yield every N lines to prevent CPU timeout
const YIELD_INTERVAL = 1000;

interface ParsedChannel {
  name: string;
  url: string;
  logo?: string;
  group?: string;
}

// CPU yield function to prevent timeout
const cpuYield = () => new Promise(resolve => setTimeout(resolve, 0));

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
      return await processM3UContent(content, stream, supabase);
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
          headers: { "User-Agent": "VLC/3.0.18", "Accept": "*/*" },
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
  let lineCount = 0;

  if (stream) {
    const encoder = new TextEncoder();
    const body = new ReadableStream({
      async start(controller) {
        const send = (data: object) => {
          try {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
          } catch (e) {}
        };

        send({ type: 'start', total: 0, message: 'Iniciando importação...' });

        try {
          while (true) {
            if (abortSignal.aborted) {
              console.log('[fetch-m3u] Abort detected');
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
              lineCount++;
              
              // CPU yield to prevent timeout
              if (lineCount % YIELD_INTERVAL === 0) {
                await cpuYield();
              }

              const trimmed = line.trim();
              
              if (trimmed.startsWith('#EXTINF:')) {
                // Simple fast parsing
                const logoMatch = trimmed.match(/tvg-logo="([^"]+)"/i);
                const groupMatch = trimmed.match(/group-title="([^"]+)"/i);
                const nameMatch = trimmed.match(/,([^,]+)$/);
                currentChannel = {
                  logo: logoMatch?.[1],
                  group: groupMatch?.[1],
                  name: nameMatch?.[1]?.trim() || 'Unknown',
                };
              } else if (trimmed && !trimmed.startsWith('#') && currentChannel.name) {
                if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
                  currentChannel.url = trimmed;
                  batch.push(currentChannel as ParsedChannel);
                  totalParsed++;

                  if (batch.length >= DB_BATCH_SIZE) {
                    const result = await insertBatchFast(supabase, batch);
                    inserted += result.inserted;
                    skipped += result.skipped;
                    batch = [];

                    // Yield after DB operation
                    await cpuYield();

                    send({ 
                      type: 'progress', 
                      processed: totalParsed, 
                      total: totalParsed, 
                      progress: 0,
                      inserted, 
                      skipped,
                      message: `Processando... ${totalParsed} canais`
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
            const result = await insertBatchFast(supabase, batch);
            inserted += result.inserted;
            skipped += result.skipped;
          }

          console.log(`[fetch-m3u] Complete: ${totalParsed} parsed, ${inserted} inserted, ${skipped} skipped`);
          send({ 
            type: 'complete', 
            inserted, 
            skipped, 
            total: totalParsed, 
            message: `Importados ${inserted} canais` 
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
      await reader.cancel();
      break;
    }

    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      lineCount++;
      
      // CPU yield to prevent timeout
      if (lineCount % YIELD_INTERVAL === 0) {
        await cpuYield();
      }

      const trimmed = line.trim();
      
      if (trimmed.startsWith('#EXTINF:')) {
        const logoMatch = trimmed.match(/tvg-logo="([^"]+)"/i);
        const groupMatch = trimmed.match(/group-title="([^"]+)"/i);
        const nameMatch = trimmed.match(/,([^,]+)$/);
        currentChannel = {
          logo: logoMatch?.[1],
          group: groupMatch?.[1],
          name: nameMatch?.[1]?.trim() || 'Unknown',
        };
      } else if (trimmed && !trimmed.startsWith('#') && currentChannel.name) {
        if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
          currentChannel.url = trimmed;
          batch.push(currentChannel as ParsedChannel);
          totalParsed++;

          if (batch.length >= DB_BATCH_SIZE) {
            const result = await insertBatchFast(supabase, batch);
            inserted += result.inserted;
            skipped += result.skipped;
            batch = [];
            await cpuYield();
          }
        }
        currentChannel = {};
      }
    }
  }

  if (batch.length > 0) {
    const result = await insertBatchFast(supabase, batch);
    inserted += result.inserted;
    skipped += result.skipped;
  }

  console.log(`[fetch-m3u] Complete: ${totalParsed} parsed, ${inserted} inserted, ${skipped} skipped`);

  return new Response(
    JSON.stringify({ 
      success: true, 
      inserted, 
      skipped, 
      total: totalParsed,
      message: `Importados ${inserted} canais`
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
  let lineCount = 0;

  if (stream) {
    const encoder = new TextEncoder();
    const body = new ReadableStream({
      async start(controller) {
        const send = (data: object) => {
          try {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
          } catch (e) {}
        };

        send({ type: 'start', total: lines.length, message: 'Iniciando importação...' });

        for (const line of lines) {
          lineCount++;
          
          // CPU yield to prevent timeout
          if (lineCount % YIELD_INTERVAL === 0) {
            await cpuYield();
          }

          const trimmed = line.trim();
          
          if (trimmed.startsWith('#EXTINF:')) {
            const logoMatch = trimmed.match(/tvg-logo="([^"]+)"/i);
            const groupMatch = trimmed.match(/group-title="([^"]+)"/i);
            const nameMatch = trimmed.match(/,([^,]+)$/);
            currentChannel = {
              logo: logoMatch?.[1],
              group: groupMatch?.[1],
              name: nameMatch?.[1]?.trim() || 'Unknown',
            };
          } else if (trimmed && !trimmed.startsWith('#') && currentChannel.name) {
            if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
              currentChannel.url = trimmed;
              batch.push(currentChannel as ParsedChannel);
              totalParsed++;

              if (batch.length >= DB_BATCH_SIZE) {
                const result = await insertBatchFast(supabase, batch);
                inserted += result.inserted;
                skipped += result.skipped;
                batch = [];
                await cpuYield();

                send({ 
                  type: 'progress', 
                  processed: totalParsed, 
                  total: totalParsed,
                  progress: 0,
                  inserted, 
                  skipped,
                  message: `Processando... ${totalParsed} canais`
                });
              }
            }
            currentChannel = {};
          }
        }

        if (batch.length > 0) {
          const result = await insertBatchFast(supabase, batch);
          inserted += result.inserted;
          skipped += result.skipped;
        }

        send({ 
          type: 'complete', 
          inserted, 
          skipped, 
          total: totalParsed, 
          message: `Importados ${inserted} canais` 
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
    lineCount++;
    
    if (lineCount % YIELD_INTERVAL === 0) {
      await cpuYield();
    }

    const trimmed = line.trim();
    
    if (trimmed.startsWith('#EXTINF:')) {
      const logoMatch = trimmed.match(/tvg-logo="([^"]+)"/i);
      const groupMatch = trimmed.match(/group-title="([^"]+)"/i);
      const nameMatch = trimmed.match(/,([^,]+)$/);
      currentChannel = {
        logo: logoMatch?.[1],
        group: groupMatch?.[1],
        name: nameMatch?.[1]?.trim() || 'Unknown',
      };
    } else if (trimmed && !trimmed.startsWith('#') && currentChannel.name) {
      if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
        currentChannel.url = trimmed;
        batch.push(currentChannel as ParsedChannel);
        totalParsed++;

        if (batch.length >= DB_BATCH_SIZE) {
          const result = await insertBatchFast(supabase, batch);
          inserted += result.inserted;
          skipped += result.skipped;
          batch = [];
        }
      }
      currentChannel = {};
    }
  }

  if (batch.length > 0) {
    const result = await insertBatchFast(supabase, batch);
    inserted += result.inserted;
    skipped += result.skipped;
  }

  return new Response(
    JSON.stringify({ 
      success: true, 
      inserted, 
      skipped, 
      total: totalParsed,
      message: `Importados ${inserted} canais`
    }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}

// ==================== FAST BATCH INSERT ====================

async function insertBatchFast(supabase: any, channels: ParsedChannel[]): Promise<{ inserted: number; skipped: number }> {
  // Simple fast processing - no heavy normalization
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
    metadata: {},
    is_series: false,
  }));

  // De-duplicate by original_url
  const uniqueMap = new Map<string, typeof records[0]>();
  for (const rec of records) {
    if (!uniqueMap.has(rec.original_url)) {
      uniqueMap.set(rec.original_url, rec);
    }
  }
  const uniqueRecords = Array.from(uniqueMap.values());

  if (uniqueRecords.length === 0) {
    return { inserted: 0, skipped: 0 };
  }

  // Fast upsert with ignore duplicates (avoid returning row data)
  const { error, count } = await supabase
    .from('iptv_channels')
    .upsert(uniqueRecords, {
      onConflict: 'original_url',
      ignoreDuplicates: true,
      count: 'exact',
      returning: 'minimal',
    });

  if (error) {
    console.error('[fetch-m3u] Batch error:', error.message);
    return { inserted: 0, skipped: uniqueRecords.length };
  }

  const inserted = typeof count === 'number' ? count : uniqueRecords.length;
  const skipped = Math.max(0, uniqueRecords.length - inserted);
  return { inserted, skipped };
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
