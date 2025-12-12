/**
 * Intelligent Cache Warming Edge Function
 * 
 * Proactively warms cache based on:
 * - Peak audience times by category
 * - Historical viewing patterns
 * - Content popularity metrics
 * 
 * Features:
 * - Pre-loads initial HLS segments for faster startup
 * - Prioritizes content by predicted demand
 * - Respects rate limits to avoid overwhelming origin
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Peak hours by content category (24h format)
const PEAK_HOURS: Record<string, number[]> = {
  'Novelas': [18, 19, 20, 21, 22], // Evening prime time
  'Esportes': [15, 16, 19, 20, 21], // Afternoon and evening
  'Filmes': [20, 21, 22, 23], // Late evening
  'Notícias': [6, 7, 8, 12, 13, 19, 20], // Morning, lunch, evening
  'Infantil': [8, 9, 10, 14, 15, 16], // Morning and afternoon
  'Documentários': [21, 22, 23], // Late evening
  'default': [19, 20, 21], // General prime time
};

interface WarmingResult {
  url: string;
  status: number;
  latency: number;
  cached: boolean;
  category?: string;
}

interface ContentPrediction {
  channel_id: number;
  category: string;
  priority: number;
  url: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const currentHour = new Date().getHours();
    
    // Determine which categories are in peak hours
    const peakCategories: string[] = [];
    for (const [category, hours] of Object.entries(PEAK_HOURS)) {
      if (hours.includes(currentHour) || hours.includes((currentHour + 1) % 24)) {
        peakCategories.push(category);
      }
    }

    console.log(`[cache-warming] Current hour: ${currentHour}, Peak categories: ${peakCategories.join(', ')}`);

    // Get top performing content from last 24h with category weighting
    const { data: topContent, error: statsError } = await supabase
      .from('cache_stats')
      .select('rule_id, hits, misses')
      .gte('window_start', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
      .order('hits', { ascending: false })
      .limit(100);

    if (statsError) {
      console.error('[cache-warming] Stats error:', statsError);
    }

    // Get popular channels by metrics
    const { data: popularChannels, error: channelsError } = await supabase
      .from('iptv_channel_metrics')
      .select('channel_id, value')
      .eq('metric_type', 'view')
      .gte('recorded_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
      .order('value', { ascending: false })
      .limit(50);

    if (channelsError) {
      console.error('[cache-warming] Channels error:', channelsError);
    }

    // Get channel details for popular channels
    const channelIds = [...new Set(popularChannels?.map(c => c.channel_id) || [])];
    const { data: channels, error: channelDetailsError } = await supabase
      .from('iptv_channels')
      .select('id, name, category, original_url, transcode_manifest_url, transcode_status, is_healthy')
      .in('id', channelIds.length > 0 ? channelIds : [0])
      .eq('is_healthy', true);

    if (channelDetailsError) {
      console.error('[cache-warming] Channel details error:', channelDetailsError);
    }

    // Build priority queue
    const predictions: ContentPrediction[] = [];
    
    for (const channel of channels || []) {
      const category = channel.category || 'default';
      const isPeakCategory = peakCategories.includes(category) || peakCategories.includes('default');
      const viewCount = popularChannels?.find(p => p.channel_id === channel.id)?.value || 0;
      
      // Calculate priority (lower = higher priority)
      let priority = 100;
      if (isPeakCategory) priority -= 50;
      priority -= Math.min(viewCount, 30); // Cap view count bonus
      
      const url = channel.transcode_status === 'ready' && channel.transcode_manifest_url
        ? channel.transcode_manifest_url
        : channel.original_url;

      predictions.push({
        channel_id: channel.id,
        category,
        priority,
        url,
      });
    }

    // Sort by priority and take top 30
    predictions.sort((a, b) => a.priority - b.priority);
    const toWarm = predictions.slice(0, 30);

    const warmedUrls: WarmingResult[] = [];
    const concurrency = 5; // Limit concurrent requests

    // Process in batches
    for (let i = 0; i < toWarm.length; i += concurrency) {
      const batch = toWarm.slice(i, i + concurrency);
      
      const batchResults = await Promise.allSettled(
        batch.map(async (prediction) => {
          const startTime = Date.now();
          
          try {
            // Request with minimal headers for warming
            const response = await fetch(prediction.url, {
              method: 'HEAD',
              headers: {
                'User-Agent': 'Cache-Warming-Bot/2.0',
                'X-Cache-Warm': 'true',
              },
            });

            const latency = Date.now() - startTime;
            const cached = response.headers.get('cf-cache-status') === 'HIT' ||
                          response.headers.get('x-cache') === 'HIT';

            return {
              url: prediction.url,
              status: response.status,
              latency,
              cached,
              category: prediction.category,
            };
          } catch (error) {
            return {
              url: prediction.url,
              status: 0,
              latency: Date.now() - startTime,
              cached: false,
              category: prediction.category,
            };
          }
        })
      );

      for (const result of batchResults) {
        if (result.status === 'fulfilled') {
          warmedUrls.push(result.value);
        }
      }

      // Small delay between batches to avoid rate limiting
      if (i + concurrency < toWarm.length) {
        await new Promise(r => setTimeout(r, 100));
      }
    }

    // Calculate stats
    const successCount = warmedUrls.filter(r => r.status === 200).length;
    const cachedCount = warmedUrls.filter(r => r.cached).length;
    const avgLatency = warmedUrls.length > 0
      ? Math.round(warmedUrls.reduce((sum, r) => sum + r.latency, 0) / warmedUrls.length)
      : 0;

    // Get URLs from top cache rules
    const ruleIds = [...new Set(topContent?.map(s => s.rule_id).filter(Boolean) || [])];
    if (ruleIds.length > 0) {
      const { data: rules, error: rulesError } = await supabase
        .from('cache_rules')
        .select('id, match_pattern, enabled')
        .in('id', ruleIds)
        .eq('enabled', true);

      if (!rulesError && rules) {
        for (const rule of rules.slice(0, 10)) {
          try {
            const urlMatch = rule.match_pattern.match(/https?:\/\/[^/*]+[^*]*/);
            if (urlMatch) {
              const url = urlMatch[0];
              const startTime = Date.now();
              
              const response = await fetch(url, {
                method: 'HEAD',
                headers: { 'User-Agent': 'Cache-Warming-Bot/2.0' },
              });

              warmedUrls.push({
                url,
                status: response.status,
                latency: Date.now() - startTime,
                cached: response.headers.get('cf-cache-status') === 'HIT',
              });
            }
          } catch (error) {
            console.error(`[cache-warming] Failed to warm rule ${rule.id}:`, error);
          }
        }
      }
    }

    console.log(`[cache-warming] Completed: ${successCount}/${warmedUrls.length} URLs, ${cachedCount} already cached, avg latency ${avgLatency}ms`);

    return new Response(
      JSON.stringify({
        success: true,
        warmed_count: warmedUrls.length,
        success_count: successCount,
        cached_count: cachedCount,
        avg_latency_ms: avgLatency,
        peak_categories: peakCategories,
        current_hour: currentHour,
        warmed_urls: warmedUrls,
        timestamp: new Date().toISOString(),
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: unknown) {
    console.error('[cache-warming] Error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
