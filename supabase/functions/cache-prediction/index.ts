import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface PredictionResult {
  pattern: string;
  confidence: number;
  suggested_ttl: number;
  reasoning: string;
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

    // Analyze cache stats from last 7 days
    const { data: stats, error } = await supabase
      .from('cache_stats')
      .select('rule_id, hits, misses, avg_response_time_ms, window_start')
      .gte('window_start', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString());

    if (error) throw error;

    // Group by rule and calculate metrics
    const ruleMetrics = new Map<string, any>();
    
    stats?.forEach(stat => {
      if (!stat.rule_id) return;
      
      if (!ruleMetrics.has(stat.rule_id)) {
        ruleMetrics.set(stat.rule_id, {
          total_hits: 0,
          total_misses: 0,
          avg_response_times: [],
        });
      }
      
      const metrics = ruleMetrics.get(stat.rule_id);
      metrics.total_hits += stat.hits;
      metrics.total_misses += stat.misses;
      metrics.avg_response_times.push(stat.avg_response_time_ms || 0);
    });

    // Generate predictions
    const predictions: PredictionResult[] = [];

    for (const [ruleId, metrics] of ruleMetrics.entries()) {
      const hitRate = metrics.total_hits / (metrics.total_hits + metrics.total_misses);
      const avgResponseTime = metrics.avg_response_times.reduce((a: number, b: number) => a + b, 0) / metrics.avg_response_times.length;

      // Get rule details
      const { data: rule } = await supabase
        .from('cache_rules')
        .select('match_pattern, ttl')
        .eq('id', ruleId)
        .single();

      if (!rule) continue;

      // ML-like prediction logic
      let confidence = 0;
      let suggestedTTL = rule.ttl;
      let reasoning = '';

      if (hitRate > 0.8 && avgResponseTime < 200) {
        // High hit rate + fast response = extend TTL
        confidence = 0.85;
        suggestedTTL = Math.min(rule.ttl * 2, 86400); // Max 24h
        reasoning = 'Alta taxa de hit (>80%) e resposta rápida (<200ms) sugerem que o conteúdo é estável e pode ter TTL maior';
      } else if (hitRate < 0.5) {
        // Low hit rate = reduce TTL
        confidence = 0.75;
        suggestedTTL = Math.max(Math.floor(rule.ttl / 2), 60); // Min 1 min
        reasoning = 'Baixa taxa de hit (<50%) sugere conteúdo dinâmico que deve ter TTL menor para evitar conteúdo desatualizado';
      } else if (avgResponseTime > 1000) {
        // Slow response = increase TTL
        confidence = 0.70;
        suggestedTTL = Math.min(rule.ttl * 1.5, 43200); // Max 12h
        reasoning = 'Tempo de resposta lento (>1s) sugere que o cache deve ser mantido por mais tempo para reduzir carga no origin';
      }

      if (suggestedTTL !== rule.ttl && confidence > 0) {
        predictions.push({
          pattern: rule.match_pattern,
          confidence,
          suggested_ttl: suggestedTTL,
          reasoning,
        });
      }
    }

    // Sort by confidence
    predictions.sort((a, b) => b.confidence - a.confidence);

    console.log(`Generated ${predictions.length} cache predictions`);

    return new Response(
      JSON.stringify({
        success: true,
        predictions: predictions.slice(0, 10), // Top 10
        analyzed_rules: ruleMetrics.size,
        timestamp: new Date().toISOString(),
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('Cache prediction error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
