/**
 * Prewarm Job Worker Template
 * 
 * Proactively warms CDN cache for popular content
 * 
 * Environment Variables Required:
 * - SUPABASE_URL
 * - SUPABASE_SERVICE_ROLE_KEY
 * - CDN_BASE_URL
 * - PREWARM_CONCURRENCY (default: 10)
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Types
interface PrewarmTarget {
  channel_id: string;
  r2_key: string;
  priority_rank: number;
  predicted_views: number;
}

interface PrewarmResult {
  key: string;
  status: 'success' | 'failed';
  duration_ms: number;
  cached: boolean;
  error?: string;
}

interface JobStats {
  total: number;
  success: number;
  failed: number;
  already_cached: number;
  avg_duration_ms: number;
  total_bytes: number;
}

// Fetch and warm a single URL
async function warmUrl(
  cdnBaseUrl: string,
  r2Key: string,
  timeout: number = 30000
): Promise<PrewarmResult> {
  const startTime = Date.now();
  const url = `${cdnBaseUrl}/${r2Key}`;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    const response = await fetch(url, {
      method: 'GET',
      signal: controller.signal,
      headers: {
        'User-Agent': 'IPTVLINK-Prewarm/1.0',
        'X-Prewarm': 'true',
      },
    });

    clearTimeout(timeoutId);

    const duration = Date.now() - startTime;
    const cacheStatus = response.headers.get('cf-cache-status') || 'UNKNOWN';

    return {
      key: r2Key,
      status: response.ok ? 'success' : 'failed',
      duration_ms: duration,
      cached: cacheStatus === 'HIT',
      error: response.ok ? undefined : `HTTP ${response.status}`,
    };
  } catch (error) {
    return {
      key: r2Key,
      status: 'failed',
      duration_ms: Date.now() - startTime,
      cached: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// Process prewarm batch with concurrency control
async function processPrewarmBatch(
  targets: PrewarmTarget[],
  cdnBaseUrl: string,
  concurrency: number
): Promise<PrewarmResult[]> {
  const results: PrewarmResult[] = [];
  const queue = [...targets];

  const workers = Array(concurrency).fill(null).map(async () => {
    while (queue.length > 0) {
      const target = queue.shift();
      if (target) {
        const result = await warmUrl(cdnBaseUrl, target.r2_key);
        results.push(result);
      }
    }
  });

  await Promise.all(workers);
  return results;
}

// Get top channels to prewarm based on predictions
async function getPrewarmTargets(
  supabase: SupabaseClient,
  limit: number = 100
): Promise<PrewarmTarget[]> {
  // First try predictions table
  const { data: predictions, error: predError } = await supabase
    .from('cdn_prewarm_predictions')
    .select('channel_id, r2_key, priority_rank, predicted_views')
    .order('priority_rank', { ascending: true })
    .limit(limit);

  if (predictions && predictions.length > 0) {
    return predictions.filter(p => p.r2_key);
  }

  // Fallback to demand stats
  const { data: stats, error: statsError } = await supabase
    .from('channel_demand_stats')
    .select(`
      channel_id,
      demand_score,
      views_24h,
      m3u_channels!inner(r2_url)
    `)
    .order('demand_score', { ascending: false })
    .limit(limit);

  if (stats) {
    return stats
      .filter((s: any) => s.m3u_channels?.r2_url)
      .map((s: any, i: number) => ({
        channel_id: s.channel_id,
        r2_key: s.m3u_channels.r2_url,
        priority_rank: i + 1,
        predicted_views: s.views_24h || 0,
      }));
  }

  return [];
}

// Log prewarm job results
async function logJobResults(
  supabase: SupabaseClient,
  jobId: string,
  results: PrewarmResult[],
  startTime: number
): Promise<void> {
  const stats: JobStats = {
    total: results.length,
    success: results.filter(r => r.status === 'success').length,
    failed: results.filter(r => r.status === 'failed').length,
    already_cached: results.filter(r => r.cached).length,
    avg_duration_ms: results.reduce((sum, r) => sum + r.duration_ms, 0) / results.length,
    total_bytes: 0, // Would need content-length tracking
  };

  const errors = results
    .filter(r => r.error)
    .map(r => ({ key: r.key, error: r.error }));

  await supabase
    .from('cdn_prewarm_jobs')
    .update({
      status: stats.failed === stats.total ? 'failed' : 'completed',
      completed_at: new Date().toISOString(),
      prewarmed_assets: stats.success,
      failed_assets: stats.failed,
      avg_prewarm_time_ms: Math.round(stats.avg_duration_ms),
      error_log: errors.length > 0 ? errors : null,
      metadata: {
        already_cached: stats.already_cached,
        total_duration_ms: Date.now() - startTime,
      },
    })
    .eq('id', jobId);
}

// Create new prewarm job
async function createJob(
  supabase: SupabaseClient,
  jobType: string,
  targetKeys: string[]
): Promise<string> {
  const { data, error } = await supabase
    .from('cdn_prewarm_jobs')
    .insert({
      job_type: jobType,
      status: 'running',
      started_at: new Date().toISOString(),
      target_r2_keys: targetKeys,
      total_assets: targetKeys.length,
    })
    .select('id')
    .single();

  if (error) throw error;
  return data.id;
}

// Main handler - Scheduled job
export default {
  async scheduled(event: ScheduledEvent, env: Record<string, string>): Promise<void> {
    console.log('[Prewarm] Starting scheduled prewarm job');
    const startTime = Date.now();

    const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
    const concurrency = parseInt(env.PREWARM_CONCURRENCY || '10', 10);

    try {
      // Get targets
      const targets = await getPrewarmTargets(supabase, 100);
      console.log(`[Prewarm] Found ${targets.length} targets to warm`);

      if (targets.length === 0) {
        console.log('[Prewarm] No targets found, skipping');
        return;
      }

      // Create job record
      const jobId = await createJob(
        supabase,
        'scheduled',
        targets.map(t => t.r2_key)
      );

      // Process targets
      const results = await processPrewarmBatch(
        targets,
        env.CDN_BASE_URL,
        concurrency
      );

      // Log results
      await logJobResults(supabase, jobId, results, startTime);

      const successRate = (results.filter(r => r.status === 'success').length / results.length * 100).toFixed(1);
      console.log(`[Prewarm] Job completed: ${successRate}% success rate`);
    } catch (error) {
      console.error('[Prewarm] Job failed:', error);
    }
  },

  // HTTP handler for manual triggers
  async fetch(request: Request, env: Record<string, string>): Promise<Response> {
    if (request.method !== 'POST') {
      return new Response('Method not allowed', { status: 405 });
    }

    const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
    const concurrency = parseInt(env.PREWARM_CONCURRENCY || '10', 10);
    const startTime = Date.now();

    try {
      const body = await request.json() as { keys?: string[]; limit?: number };
      
      let targets: PrewarmTarget[];
      
      if (body.keys && body.keys.length > 0) {
        // Manual list of keys
        targets = body.keys.map((key, i) => ({
          channel_id: '',
          r2_key: key,
          priority_rank: i + 1,
          predicted_views: 0,
        }));
      } else {
        // Auto-detect from predictions
        targets = await getPrewarmTargets(supabase, body.limit || 50);
      }

      const jobId = await createJob(
        supabase,
        'manual',
        targets.map(t => t.r2_key)
      );

      const results = await processPrewarmBatch(targets, env.CDN_BASE_URL, concurrency);
      await logJobResults(supabase, jobId, results, startTime);

      return new Response(JSON.stringify({
        jobId,
        total: results.length,
        success: results.filter(r => r.status === 'success').length,
        failed: results.filter(r => r.status === 'failed').length,
        cached: results.filter(r => r.cached).length,
        duration_ms: Date.now() - startTime,
      }), {
        headers: { 'Content-Type': 'application/json' },
      });
    } catch (error) {
      return new Response(JSON.stringify({
        error: error instanceof Error ? error.message : 'Unknown error',
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  },
};
