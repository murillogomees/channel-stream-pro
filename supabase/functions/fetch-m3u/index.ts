/**
 * Fetch M3U - Unified Import to iptv_channels
 * 
 * SEMPRE grava direto em iptv_channels (streaming mode).
 * Retorna apenas resumo { inserted, skipped, total } para o frontend.
 * Otimizado para mínimo egress e máxima performance.
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const DB_BATCH_SIZE = 100;
const MAX_CHANNELS = 50000; // Limite de segurança por import

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
    const { url, content } = await req.json();

    if (!url && !content) {
      throw new Error("URL ou conteúdo M3U é obrigatório");
    }

    let m3uContent = content || '';

    // Fetch from URL if provided
    if (url && !m3uContent) {
      console.log("[fetch-m3u] Fetching from URL:", url.substring(0, 80));
      
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

      if (!response.ok) {
        // Try HTTP fallback if HTTPS fails
        if (fetchUrl.startsWith('https://')) {
          const httpUrl = fetchUrl.replace('https://', 'http://');
          console.log('[fetch-m3u] HTTPS failed, trying HTTP fallback');
          const httpResponse = await fetch(httpUrl, {
            method: 'GET',
            headers: {
              "User-Agent": "VLC/3.0.18 LibVLC/3.0.18",
              "Accept": "*/*",
            },
          });
          if (!httpResponse.ok) {
            throw new Error(`Failed to fetch M3U: HTTP ${httpResponse.status}`);
          }
          m3uContent = await httpResponse.text();
        } else {
          throw new Error(`Failed to fetch M3U: HTTP ${response.status}`);
        }
      } else {
        m3uContent = await response.text();
      }
    }

    if (!m3uContent) {
      throw new Error('Nenhum conteúdo M3U fornecido');
    }

    // Validate M3U content
    if (!m3uContent.includes('#EXTM3U') && !m3uContent.includes('#EXTINF')) {
      throw new Error('Conteúdo não parece ser M3U válido');
    }

    console.log("[fetch-m3u] Content size:", Math.round(m3uContent.length / 1024), "KB");

    // Parse M3U content
    const channels = parseM3U(m3uContent);
    console.log(`[fetch-m3u] Parsed ${channels.length} channels`);

    if (channels.length === 0) {
      throw new Error('Nenhum canal encontrado no conteúdo M3U');
    }

    // Limit channels per import
    const channelsToImport = channels.slice(0, MAX_CHANNELS);
    if (channels.length > MAX_CHANNELS) {
      console.log(`[fetch-m3u] Limiting to ${MAX_CHANNELS} channels`);
    }

    // Insert directly into iptv_channels in batches
    let inserted = 0;
    let skipped = 0;

    for (let i = 0; i < channelsToImport.length; i += DB_BATCH_SIZE) {
      const batch = channelsToImport.slice(i, i + DB_BATCH_SIZE);
      
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
        metadata: {
          tvg_id: ch.tvgId || null,
          tvg_name: ch.tvgName || null,
          imported_at: new Date().toISOString(),
        }
      }));

      const { error } = await supabase
        .from('iptv_channels')
        .upsert(records, { 
          onConflict: 'slug',
          ignoreDuplicates: true 
        });

      if (error) {
        console.error('[fetch-m3u] Batch upsert error:', error.message);
        // Try inserting one by one for this batch
        for (const record of records) {
          const { error: singleError } = await supabase
            .from('iptv_channels')
            .insert(record);
          
          if (singleError) {
            if (singleError.code === '23505') { // Duplicate
              skipped++;
            } else {
              console.error('[fetch-m3u] Single insert error:', singleError.message);
            }
          } else {
            inserted++;
          }
        }
      } else {
        inserted += batch.length;
      }

      // Log progress every 1000 channels
      if ((i + DB_BATCH_SIZE) % 1000 === 0) {
        console.log(`[fetch-m3u] Progress: ${Math.min(i + DB_BATCH_SIZE, channelsToImport.length)}/${channelsToImport.length}`);
      }
    }

    console.log(`[fetch-m3u] Complete: ${inserted} inserted, ${skipped} skipped`);

    return new Response(
      JSON.stringify({ 
        success: true,
        inserted,
        skipped,
        total: channels.length,
        limited: channels.length > MAX_CHANNELS,
        message: `Importados ${inserted} canais com sucesso${skipped > 0 ? ` (${skipped} duplicados ignorados)` : ''}`
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

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    if (line.startsWith('#EXTINF:')) {
      // Parse EXTINF line
      const logoMatch = line.match(/tvg-logo="([^"]+)"/i);
      const groupMatch = line.match(/group-title="([^"]+)"/i);
      const tvgIdMatch = line.match(/tvg-id="([^"]+)"/i);
      const tvgNameMatch = line.match(/tvg-name="([^"]+)"/i);
      const nameMatch = line.match(/,(.+)$/);

      currentChannel = {
        logo: logoMatch?.[1],
        group: groupMatch?.[1],
        tvgId: tvgIdMatch?.[1],
        tvgName: tvgNameMatch?.[1],
        name: nameMatch?.[1]?.trim() || 'Unknown',
      };
    } else if (line && !line.startsWith('#') && currentChannel.name) {
      // This is the URL line
      if (line.startsWith('http://') || line.startsWith('https://')) {
        currentChannel.url = line;
        channels.push(currentChannel as ParsedChannel);
      }
      currentChannel = {};
    }
  }

  return channels;
}

function generateSlug(name: string): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 6);
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .substring(0, 50);
  return `${base}-${timestamp}-${random}`;
}

function detectContentType(url: string, group?: string): string {
  const urlLower = url.toLowerCase();
  const groupLower = (group || '').toLowerCase();
  
  // Check URL patterns
  if (urlLower.includes('/movie/') || urlLower.includes('.mp4') || urlLower.includes('.mkv')) {
    return 'vod';
  }
  if (urlLower.includes('/series/')) {
    return 'series';
  }
  
  // Check group patterns
  if (groupLower.includes('vod') || groupLower.includes('filme') || groupLower.includes('movie')) {
    return 'vod';
  }
  if (groupLower.includes('série') || groupLower.includes('series')) {
    return 'series';
  }
  
  return 'live';
}
