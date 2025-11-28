/**
 * Calculate Trending Content
 * Automatically calculates Top 10 based on watch history and analytics
 * Runs via cron job daily/weekly
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ContentViewData {
  content_id: string;
  content_name: string;
  content_type: string;
  content_logo: string | null;
  content_category: string | null;
  view_count: number;
  unique_viewers: number;
  total_watch_time: number;
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('[calculate-trending] Starting trending calculation...');

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Parse request body for ranking type
    let rankingType = 'weekly';
    try {
      const body = await req.json();
      if (body.ranking_type) {
        rankingType = body.ranking_type;
      }
    } catch {
      // Use default ranking type
    }

    console.log(`[calculate-trending] Calculating ${rankingType} rankings...`);

    // Calculate date range based on ranking type
    const now = new Date();
    let startDate: Date;
    
    switch (rankingType) {
      case 'daily':
        startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        break;
      case 'weekly':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case 'monthly':
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      default:
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    }

    console.log(`[calculate-trending] Date range: ${startDate.toISOString()} to ${now.toISOString()}`);

    // Get view data from watch_history
    const { data: watchHistory, error: historyError } = await supabase
      .from('watch_history')
      .select('content_id, content_type, content_name, content_logo, content_category, duration_seconds')
      .gte('watched_at', startDate.toISOString());

    if (historyError) {
      console.error('[calculate-trending] Error fetching watch history:', historyError);
      throw historyError;
    }

    console.log(`[calculate-trending] Found ${watchHistory?.length || 0} watch history records`);

    // Get analytics data for additional scoring
    const { data: analytics, error: analyticsError } = await supabase
      .from('player_analytics')
      .select('content_id, content_type, profile_id')
      .eq('event_type', 'play')
      .gte('created_at', startDate.toISOString());

    if (analyticsError) {
      console.error('[calculate-trending] Error fetching analytics:', analyticsError);
      // Continue without analytics data
    }

    console.log(`[calculate-trending] Found ${analytics?.length || 0} analytics records`);

    // Aggregate content data
    const contentMap = new Map<string, ContentViewData>();

    // Process watch history
    if (watchHistory) {
      for (const record of watchHistory) {
        const existing = contentMap.get(record.content_id);
        if (existing) {
          existing.view_count += 1;
          existing.total_watch_time += record.duration_seconds || 0;
        } else {
          contentMap.set(record.content_id, {
            content_id: record.content_id,
            content_name: record.content_name,
            content_type: record.content_type,
            content_logo: record.content_logo,
            content_category: record.content_category,
            view_count: 1,
            unique_viewers: 0,
            total_watch_time: record.duration_seconds || 0,
          });
        }
      }
    }

    // Process analytics for unique viewers
    if (analytics) {
      const viewerMap = new Map<string, Set<string>>();
      
      for (const record of analytics) {
        if (!viewerMap.has(record.content_id)) {
          viewerMap.set(record.content_id, new Set());
        }
        viewerMap.get(record.content_id)!.add(record.profile_id);
      }

      for (const [contentId, viewers] of viewerMap) {
        const existing = contentMap.get(contentId);
        if (existing) {
          existing.unique_viewers = viewers.size;
        }
      }
    }

    // Calculate scores and rank
    const contentList = Array.from(contentMap.values());
    
    // Score formula: views * 1 + unique_viewers * 2 + (watch_time / 60) * 0.5
    const scoredContent = contentList.map(content => ({
      ...content,
      score: content.view_count * 1 + 
             content.unique_viewers * 2 + 
             (content.total_watch_time / 60) * 0.5,
    }));

    // Sort by score descending
    scoredContent.sort((a, b) => b.score - a.score);

    // Take top 10
    const top10 = scoredContent.slice(0, 10);

    console.log(`[calculate-trending] Top 10 calculated:`, top10.map(c => c.content_name));

    // Clear existing rankings for this type
    const { error: deleteError } = await supabase
      .from('trending_rankings')
      .delete()
      .eq('ranking_type', rankingType);

    if (deleteError) {
      console.error('[calculate-trending] Error deleting old rankings:', deleteError);
      throw deleteError;
    }

    // Insert new rankings
    if (top10.length > 0) {
      const rankingsToInsert = top10.map((content, index) => ({
        content_id: content.content_id,
        content_type: content.content_type,
        content_name: content.content_name,
        content_logo: content.content_logo,
        content_category: content.content_category,
        ranking_type: rankingType,
        rank_position: index + 1,
        view_count: content.view_count,
        score: content.score,
        ranking_date: now.toISOString().split('T')[0],
      }));

      const { error: insertError } = await supabase
        .from('trending_rankings')
        .insert(rankingsToInsert);

      if (insertError) {
        console.error('[calculate-trending] Error inserting rankings:', insertError);
        throw insertError;
      }

      console.log(`[calculate-trending] Successfully inserted ${rankingsToInsert.length} rankings`);
    } else {
      console.log('[calculate-trending] No content to rank');
    }

    return new Response(
      JSON.stringify({
        success: true,
        ranking_type: rankingType,
        items_ranked: top10.length,
        calculated_at: now.toISOString(),
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error) {
    console.error('[calculate-trending] Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
