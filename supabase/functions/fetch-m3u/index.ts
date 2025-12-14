/**
 * Fetch M3U - Unified Import to iptv_channels with Progress Streaming
 * 
 * SEMPRE grava direto em iptv_channels.
 * Retorna progresso via SSE para o frontend.
 * Otimizado para mínimo egress e máxima performance.
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const DB_BATCH_SIZE = 500; // larger batch to reduce DB roundtrips and avoid CPU timeouts
const MAX_CHANNELS = 50000; // safety limit to avoid memory exhaustion on huge playlists

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

    let m3uContent = content || '';

    // Fetch from URL if provided
    if (url && !m3uContent) {
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
          m3uContent = await httpResponse.text();
        } else {
          throw new Error(`Failed to fetch M3U: HTTP ${response.status}`);
        }
      } else {
        m3uContent = await response.text();
      }
    }

    if (!m3uContent) throw new Error('Nenhum conteúdo M3U fornecido');
    if (!m3uContent.includes('#EXTM3U') && !m3uContent.includes('#EXTINF')) {
      throw new Error('Conteúdo não parece ser M3U válido');
    }

    // Parse M3U content
    const channels = parseM3U(m3uContent);
    console.log(`[fetch-m3u] Parsed ${channels.length} channels`);

    if (channels.length === 0) throw new Error('Nenhum canal encontrado no conteúdo M3U');

    const total = channels.length;

    // If streaming mode requested, use SSE
    if (stream) {
      const encoder = new TextEncoder();
      const body = new ReadableStream({
        async start(controller) {
          const send = (data: object) => {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
          };

          send({ type: 'start', total });

          let inserted = 0;
          let skipped = 0;

          for (let i = 0; i < channels.length; i += DB_BATCH_SIZE) {
            const batch = channels.slice(i, i + DB_BATCH_SIZE);
            
            const records = batch.map(ch => ({
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

            // Use upsert with original_url as conflict key
            const { data: upsertData, error } = await supabase
              .from('iptv_channels')
              .upsert(records, { 
                onConflict: 'original_url',
                ignoreDuplicates: true
              })
              .select('id');

            if (error) {
              console.error('[fetch-m3u] Batch error:', error.message);
              skipped += batch.length;
            } else {
              const insertedCount = upsertData?.length || 0;
              inserted += insertedCount;
              skipped += batch.length - insertedCount;
            }

            const processed = Math.min(i + DB_BATCH_SIZE, total);
            const progress = Math.round((processed / total) * 100);
            send({ type: 'progress', processed, total, progress, inserted, skipped });
          }

          send({ type: 'complete', inserted, skipped, total, message: `Importados ${inserted} canais` });
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

    // Non-streaming mode (legacy)
    let inserted = 0;
    let skipped = 0;

    for (let i = 0; i < channels.length; i += DB_BATCH_SIZE) {
      const batch = channels.slice(i, i + DB_BATCH_SIZE);
      
      const records = batch.map(ch => ({
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

      // Use upsert with original_url as conflict key
      const { data: upsertData, error } = await supabase
        .from('iptv_channels')
        .upsert(records, { 
          onConflict: 'original_url',
          ignoreDuplicates: true
        })
        .select('id');

      if (error) {
        console.error('[fetch-m3u] Batch error:', error.message);
        skipped += batch.length;
      } else {
        const insertedCount = upsertData?.length || 0;
        inserted += insertedCount;
        skipped += batch.length - insertedCount;
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, inserted, skipped, total: channels.length,
        message: `Importados ${inserted} canais${skipped > 0 ? ` (${skipped} duplicados)` : ''}`
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: any) {
    console.error("[fetch-m3u] Error:", error.message);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

function parseM3U(content: string): ParsedChannel[] {
  const lines = content.split('\n');
  const channels: ParsedChannel[] = [];
  let currentChannel: Partial<ParsedChannel> = {};

  for (const line of lines) {
    if (channels.length >= MAX_CHANNELS) {
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
        logo: logoMatch?.[1], group: groupMatch?.[1],
        tvgId: tvgIdMatch?.[1], tvgName: tvgNameMatch?.[1],
        name: nameMatch?.[1]?.trim() || 'Unknown',
      };
    } else if (trimmed && !trimmed.startsWith('#') && currentChannel.name) {
      if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
        currentChannel.url = trimmed;
        channels.push(currentChannel as ParsedChannel);
      }
      currentChannel = {};
    }
  }

  if (channels.length === MAX_CHANNELS) {
    console.log(`[fetch-m3u] Reached MAX_CHANNELS limit (${MAX_CHANNELS}), remaining entries will be ignored to avoid OOM.`);
  }

  return channels;
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
