import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Get top performing content from last 24h
    const { data: topContent, error: statsError } = await supabase
      .from('cache_stats')
      .select('rule_id, hits, misses')
      .gte('window_start', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
      .order('hits', { ascending: false })
      .limit(50);

    if (statsError) throw statsError;

    // Get URLs from top rules
    const ruleIds = [...new Set(topContent?.map(s => s.rule_id).filter(Boolean) || [])];
    const { data: rules, error: rulesError } = await supabase
      .from('cache_rules')
      .select('id, match_pattern, enabled')
      .in('id', ruleIds)
      .eq('enabled', true);

    if (rulesError) throw rulesError;

    const warmedUrls = [];
    const cdnWorkerUrl = Deno.env.get('CDN_WORKER_URL') || 'https://cdn-worker.example.workers.dev';

    // Warm cache by making requests
    for (const rule of rules || []) {
      try {
        // Extract base URL from pattern
        const urlMatch = rule.match_pattern.match(/https?:\/\/[^/*]+[^*]*/);
        if (urlMatch) {
          const url = urlMatch[0];
          console.log(`Warming cache for: ${url}`);
          
          const response = await fetch(url, {
            method: 'HEAD',
            headers: {
              'User-Agent': 'Cache-Warming-Bot/1.0',
            },
          });

          warmedUrls.push({
            url,
            status: response.status,
            rule_id: rule.id,
          });
        }
      } catch (error) {
        console.error(`Failed to warm ${rule.match_pattern}:`, error);
      }
    }

    console.log(`Cache warming completed: ${warmedUrls.length} URLs warmed`);

    return new Response(
      JSON.stringify({
        success: true,
        warmed_count: warmedUrls.length,
        warmed_urls: warmedUrls,
        timestamp: new Date().toISOString(),
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('Cache warming error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
