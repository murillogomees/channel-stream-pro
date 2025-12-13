/**
 * Process M3U Import - Simplified
 * 
 * Imports M3U channels directly into iptv_channels table.
 * Supports both URL and pasted content.
 * Handles HTTP URLs correctly for M3U playlists.
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ImportPayload {
  content?: string;
  url?: string;
  sessionId?: string;
}

interface ParsedChannel {
  name: string;
  url: string;
  logo?: string;
  group?: string;
  tvgId?: string;
}

const DB_BATCH_SIZE = 100;
const MAX_CHANNELS = 10000; // Limit per import to avoid timeout

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    const payload: ImportPayload = await req.json();
    console.log('[ProcessM3U] Starting import');

    let m3uContent = payload.content || '';

    // Fetch content from URL if provided
    if (payload.url && !m3uContent) {
      console.log('[ProcessM3U] Fetching from URL:', payload.url.substring(0, 80));
      
      let fetchUrl = payload.url;
      
      // Try to detect and use HTTP for common IPTV ports
      try {
        const urlObj = new URL(payload.url);
        const httpPorts = ['8880', '8000', '25461', '25462', '8080'];
        if (urlObj.protocol === 'https:' && httpPorts.includes(urlObj.port)) {
          fetchUrl = payload.url.replace('https://', 'http://');
          console.log('[ProcessM3U] Forcing HTTP for Xtream port:', urlObj.port);
        }
      } catch {}
      
      // Fetch with VLC user agent for compatibility
      const response = await fetch(fetchUrl, {
        headers: {
          'User-Agent': 'VLC/3.0.18 LibVLC/3.0.18',
          'Accept': '*/*',
        },
      });

      if (!response.ok) {
        // Try HTTP fallback if HTTPS fails
        if (fetchUrl.startsWith('https://')) {
          const httpUrl = fetchUrl.replace('https://', 'http://');
          console.log('[ProcessM3U] HTTPS failed, trying HTTP');
          const httpResponse = await fetch(httpUrl, {
            headers: {
              'User-Agent': 'VLC/3.0.18 LibVLC/3.0.18',
              'Accept': '*/*',
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
      throw new Error('No M3U content provided');
    }

    // Validate M3U content
    if (!m3uContent.includes('#EXTM3U') && !m3uContent.includes('#EXTINF')) {
      throw new Error('Content does not appear to be valid M3U');
    }

    // Parse M3U content
    const channels = parseM3U(m3uContent);
    console.log(`[ProcessM3U] Parsed ${channels.length} channels`);

    if (channels.length === 0) {
      throw new Error('No channels found in M3U content');
    }

    // Limit channels per import
    const channelsToImport = channels.slice(0, MAX_CHANNELS);
    if (channels.length > MAX_CHANNELS) {
      console.log(`[ProcessM3U] Limiting import to ${MAX_CHANNELS} channels`);
    }

    // Insert in batches
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
        content_type: detectContentType(ch.url),
        is_healthy: true,
        health_score: 100,
        transcode_status: 'none',
        shard_id: 0,
      }));

      const { error } = await supabase
        .from('iptv_channels')
        .upsert(records, { 
          onConflict: 'slug',
          ignoreDuplicates: true 
        });

      if (error) {
        console.error('[ProcessM3U] Batch insert error:', error);
        // Try inserting one by one for this batch
        for (const record of records) {
          const { error: singleError } = await supabase
            .from('iptv_channels')
            .insert(record);
          
          if (singleError) {
            if (singleError.code === '23505') { // Duplicate
              skipped++;
            } else {
              console.error('[ProcessM3U] Single insert error:', singleError);
            }
          } else {
            inserted++;
          }
        }
      } else {
        inserted += batch.length;
      }

      if ((i + DB_BATCH_SIZE) % 500 === 0) {
        console.log(`[ProcessM3U] Progress: ${Math.min(i + DB_BATCH_SIZE, channelsToImport.length)}/${channelsToImport.length}`);
      }
    }

    console.log(`[ProcessM3U] Complete: ${inserted} inserted, ${skipped} skipped`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        data: { 
          inserted, 
          skipped,
          total: channels.length,
          limited: channels.length > MAX_CHANNELS,
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('[ProcessM3U] Error:', error.message);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
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
      const logoMatch = line.match(/tvg-logo="([^"]+)"/);
      const groupMatch = line.match(/group-title="([^"]+)"/);
      const tvgIdMatch = line.match(/tvg-id="([^"]+)"/);
      const nameMatch = line.match(/,(.+)$/);

      currentChannel = {
        logo: logoMatch?.[1],
        group: groupMatch?.[1],
        tvgId: tvgIdMatch?.[1],
        name: nameMatch?.[1]?.trim() || 'Unknown',
      };
    } else if (line && !line.startsWith('#') && currentChannel.name) {
      // This is the URL line - accept both HTTP and HTTPS
      currentChannel.url = line;
      channels.push(currentChannel as ParsedChannel);
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

function detectContentType(url: string): string {
  const urlLower = url.toLowerCase();
  if (urlLower.includes('/movie/') || urlLower.includes('.mp4') || urlLower.includes('.mkv')) {
    return 'vod';
  }
  if (urlLower.includes('/series/')) {
    return 'series';
  }
  return 'live';
}
