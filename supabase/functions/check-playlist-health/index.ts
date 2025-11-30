/**
 * Check Playlist Health - Optimized version
 * 
 * Performs lightweight health checks on M3U playlists without
 * loading full content into memory to avoid worker limits.
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
};

interface PlaylistHealthCheck {
  m3u_list_id: string;
  list_name: string;
  m3u_url: string;
  status: 'active' | 'inactive' | 'error';
  response_time_ms?: number;
  http_status_code?: number;
  error_message?: string;
  channel_count?: number;
}

// Maximum lists to check per invocation to avoid timeout
const MAX_LISTS_PER_RUN = 10;
// Maximum bytes to read for channel counting (100KB sample)
const MAX_SAMPLE_BYTES = 100 * 1024;

async function countChannelsFromSample(url: string): Promise<number | undefined> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);
    
    const response = await fetch(url, {
      method: 'GET',
      signal: controller.signal,
      headers: {
        'Range': `bytes=0-${MAX_SAMPLE_BYTES}`, // Only fetch first 100KB
      },
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok && response.status !== 206) {
      return undefined;
    }
    
    // Read as stream to avoid loading everything into memory
    const reader = response.body?.getReader();
    if (!reader) return undefined;
    
    let text = '';
    let bytesRead = 0;
    const decoder = new TextDecoder();
    
    while (bytesRead < MAX_SAMPLE_BYTES) {
      const { done, value } = await reader.read();
      if (done) break;
      
      text += decoder.decode(value, { stream: true });
      bytesRead += value.length;
      
      if (bytesRead >= MAX_SAMPLE_BYTES) break;
    }
    
    reader.cancel();
    
    // Count #EXTINF entries in sample
    const matches = text.match(/#EXTINF/gi);
    const sampleCount = matches ? matches.length : 0;
    
    // If we got a 206 (partial), estimate total based on Content-Range
    const contentRange = response.headers.get('Content-Range');
    if (contentRange && sampleCount > 0) {
      const match = contentRange.match(/\/(\d+)/);
      if (match) {
        const totalSize = parseInt(match[1], 10);
        const ratio = totalSize / bytesRead;
        return Math.round(sampleCount * ratio);
      }
    }
    
    return sampleCount;
  } catch {
    return undefined;
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Parse request body for options
    let options = { limit: MAX_LISTS_PER_RUN, offset: 0, fullScan: false };
    try {
      if (req.method === 'POST') {
        const body = await req.json();
        options = { ...options, ...body };
      }
    } catch {
      // Use defaults
    }

    console.log(`[PlaylistHealth] Starting check (limit: ${options.limit}, offset: ${options.offset})`);

    // Fetch active M3U lists with pagination
    const { data: m3uLists, error: listsError, count } = await supabase
      .from('m3u_lists')
      .select('id, name, file_url, status', { count: 'exact' })
      .eq('status', 'active')
      .range(options.offset, options.offset + options.limit - 1);

    if (listsError) {
      console.error('[PlaylistHealth] Error fetching lists:', listsError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch M3U lists' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!m3uLists || m3uLists.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: true,
          message: 'No active M3U lists found', 
          stats: { total: 0, active: 0, inactive: 0, error: 0, avgResponseTime: 0 },
          hasMore: false,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[PlaylistHealth] Checking ${m3uLists.length} lists (total: ${count})`);

    const results: PlaylistHealthCheck[] = [];

    // Process lists concurrently in small batches
    const CONCURRENT_CHECKS = 3;
    
    for (let i = 0; i < m3uLists.length; i += CONCURRENT_CHECKS) {
      const batch = m3uLists.slice(i, i + CONCURRENT_CHECKS);
      
      const batchResults = await Promise.all(batch.map(async (list) => {
        const startTime = Date.now();
        let status: 'active' | 'inactive' | 'error' = 'error';
        let httpStatusCode: number | undefined;
        let errorMessage: string | undefined;
        let channelCount: number | undefined;

        try {
          // Use HEAD request for quick health check
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 8000);
          
          const headResponse = await fetch(list.file_url, {
            method: 'HEAD',
            signal: controller.signal,
          });
          
          clearTimeout(timeoutId);
          httpStatusCode = headResponse.status;

          if (headResponse.ok) {
            status = 'active';
            
            // Try to estimate channel count from sample (non-blocking)
            if (options.fullScan) {
              channelCount = await countChannelsFromSample(list.file_url);
            }
            
            console.log(`[PlaylistHealth] ✓ ${list.name} - active${channelCount ? ` (~${channelCount} ch)` : ''}`);
          } else {
            status = 'inactive';
            errorMessage = `HTTP ${headResponse.status}`;
            console.log(`[PlaylistHealth] ⚠ ${list.name} - ${errorMessage}`);
          }
        } catch (error: any) {
          status = 'error';
          errorMessage = error.name === 'AbortError' ? 'Timeout' : (error.message || 'Unknown error');
          console.log(`[PlaylistHealth] ✗ ${list.name} - ${errorMessage}`);
        }

        return {
          m3u_list_id: list.id,
          list_name: list.name,
          m3u_url: list.file_url,
          status,
          response_time_ms: Date.now() - startTime,
          http_status_code: httpStatusCode,
          error_message: errorMessage,
          channel_count: channelCount,
        };
      }));
      
      results.push(...batchResults);
    }

    // Save results (batch insert)
    const healthChecks = results.map(r => ({
      client_id: r.m3u_list_id,
      playlist_id: r.m3u_list_id,
      m3u_url: r.m3u_url,
      status: r.status,
      response_time_ms: r.response_time_ms,
      http_status_code: r.http_status_code,
      error_message: r.error_message,
      last_checked_at: new Date().toISOString(),
    }));

    const { error: insertError } = await supabase
      .from('playlist_health_checks')
      .insert(healthChecks);

    if (insertError) {
      console.warn('[PlaylistHealth] Insert warning:', insertError.message);
    }

    // Calculate stats
    const stats = {
      total: results.length,
      active: results.filter(r => r.status === 'active').length,
      inactive: results.filter(r => r.status === 'inactive').length,
      error: results.filter(r => r.status === 'error').length,
      avgResponseTime: results.length > 0 
        ? Math.round(results.reduce((sum, r) => sum + (r.response_time_ms || 0), 0) / results.length)
        : 0,
    };

    const hasMore = (options.offset + options.limit) < (count || 0);

    console.log(`[PlaylistHealth] Complete: ${stats.active}/${stats.total} active, hasMore: ${hasMore}`);

    return new Response(
      JSON.stringify({
        success: true,
        message: `${stats.active}/${stats.total} lists active`,
        stats,
        results: results.map(r => ({
          name: r.list_name,
          status: r.status,
          responseTime: r.response_time_ms,
          channels: r.channel_count,
          error: r.error_message,
        })),
        pagination: {
          offset: options.offset,
          limit: options.limit,
          total: count,
          hasMore,
        },
        timestamp: new Date().toISOString(),
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('[PlaylistHealth] Fatal error:', error);
    return new Response(
      JSON.stringify({ 
        success: false,
        error: 'Health check failed',
        details: error.message 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
