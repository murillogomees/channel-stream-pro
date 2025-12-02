import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface AlertConfig {
  hit_rate_threshold: number;
  error_rate_threshold: number;
  response_time_threshold: number;
  check_window_hours: number;
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

    // Default alert thresholds
    const config: AlertConfig = {
      hit_rate_threshold: 70, // Alert if hit rate < 70%
      error_rate_threshold: 5, // Alert if error rate > 5%
      response_time_threshold: 500, // Alert if avg response > 500ms
      check_window_hours: 1,
    };

    // Get recent cache stats
    const { data: stats, error: statsError } = await supabase
      .from('cache_stats')
      .select('*')
      .gte('window_start', new Date(Date.now() - config.check_window_hours * 60 * 60 * 1000).toISOString());

    if (statsError) throw statsError;

    const alerts = [];

    if (stats && stats.length > 0) {
      // Calculate aggregate metrics
      const totalHits = stats.reduce((sum, s) => sum + s.hits, 0);
      const totalMisses = stats.reduce((sum, s) => sum + s.misses, 0);
      const totalErrors = stats.reduce((sum, s) => sum + s.errors, 0);
      const totalRequests = totalHits + totalMisses;
      const avgResponseTime = stats.reduce((sum, s) => sum + (s.avg_response_time_ms || 0), 0) / stats.length;

      const hitRate = totalRequests > 0 ? (totalHits / totalRequests) * 100 : 0;
      const errorRate = totalRequests > 0 ? (totalErrors / totalRequests) * 100 : 0;

      // Check thresholds
      if (hitRate < config.hit_rate_threshold) {
        alerts.push({
          type: 'low_hit_rate',
          severity: 'warning',
          message: `Cache hit rate is ${hitRate.toFixed(1)}% (threshold: ${config.hit_rate_threshold}%)`,
          value: hitRate,
          threshold: config.hit_rate_threshold,
        });
      }

      if (errorRate > config.error_rate_threshold) {
        alerts.push({
          type: 'high_error_rate',
          severity: 'error',
          message: `Cache error rate is ${errorRate.toFixed(1)}% (threshold: ${config.error_rate_threshold}%)`,
          value: errorRate,
          threshold: config.error_rate_threshold,
        });
      }

      if (avgResponseTime > config.response_time_threshold) {
        alerts.push({
          type: 'slow_response',
          severity: 'warning',
          message: `Average response time is ${avgResponseTime.toFixed(0)}ms (threshold: ${config.response_time_threshold}ms)`,
          value: avgResponseTime,
          threshold: config.response_time_threshold,
        });
      }
    }

    console.log(`Cache alerts check: ${alerts.length} alerts generated`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        alerts,
        checked_at: new Date().toISOString(),
        config,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('Cache alerts error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
