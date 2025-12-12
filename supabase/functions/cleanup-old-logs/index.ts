/**
 * Cleanup Old Logs Edge Function
 * 
 * Runs weekly via pg_cron to:
 * - Delete logs older than 30 days
 * - Create aggregated summaries before deletion
 * - Clean up old notification logs, activity logs, etc.
 * 
 * Schedule: Weekly on Sundays at 4:00 AM
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const CRON_SECRET = Deno.env.get('CRON_SECRET');

// Retention periods (in days)
const RETENTION_PERIODS: Record<string, number> = {
  activity_logs: 30,
  notification_logs: 30,
  auth_sessions_log: 14,
  mercado_pago_webhooks: 60,
  affiliate_link_clicks: 90,
  iptv_channel_metrics: 7,
  health_checks: 3,
  api_usage: 7,
};

interface CleanupResult {
  table: string;
  deletedCount: number;
  retentionDays: number;
  success: boolean;
  error?: string;
}

async function cleanupTable(
  supabase: ReturnType<typeof createClient>,
  tableName: string,
  retentionDays: number,
  dateColumn = 'created_at'
): Promise<number> {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - retentionDays);
  
  const { data, error, count } = await supabase
    .from(tableName)
    .delete()
    .lt(dateColumn, cutoffDate.toISOString())
    .select('id', { count: 'exact' });
  
  if (error) throw error;
  
  return count || 0;
}

async function createDailySummary(
  supabase: ReturnType<typeof createClient>,
  date: string
): Promise<void> {
  // Aggregate activity logs for the day
  const { data: activityStats } = await supabase
    .from('activity_logs')
    .select('action, entity_type')
    .gte('created_at', `${date}T00:00:00`)
    .lt('created_at', `${date}T23:59:59`);

  if (!activityStats || activityStats.length === 0) return;

  // Count actions by type
  const actionCounts: Record<string, number> = {};
  const entityCounts: Record<string, number> = {};
  
  for (const log of activityStats) {
    actionCounts[log.action] = (actionCounts[log.action] || 0) + 1;
    if (log.entity_type) {
      entityCounts[log.entity_type] = (entityCounts[log.entity_type] || 0) + 1;
    }
  }

  // Store summary (could be in a dedicated summary table)
  await supabase.from('activity_logs').insert({
    action: 'daily_summary',
    entity_type: 'system',
    details: {
      date,
      total_events: activityStats.length,
      action_counts: actionCounts,
      entity_counts: entityCounts,
      summary_type: 'daily',
    },
  });

  console.log(`[cleanup-old-logs] Created summary for ${date}: ${activityStats.length} events`);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify cron secret or admin auth
    const authHeader = req.headers.get('Authorization');
    const cronSecret = req.headers.get('x-cron-secret');
    
    const isAuthorized = 
      (CRON_SECRET && cronSecret === CRON_SECRET) ||
      (authHeader?.includes(SUPABASE_SERVICE_ROLE_KEY));

    if (!isAuthorized) {
      // Check for admin role
      const supabase = createClient(SUPABASE_URL, Deno.env.get('SUPABASE_ANON_KEY')!, {
        global: { headers: { Authorization: authHeader || '' } },
      });
      
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        return new Response(
          JSON.stringify({ error: 'Unauthorized' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      const { data: roles } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .single();
      
      if (!roles || !['admin', 'master'].includes(roles.role)) {
        return new Response(
          JSON.stringify({ error: 'Admin access required' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const startTime = Date.now();
    
    console.log('[cleanup-old-logs] Starting cleanup...');

    const results: CleanupResult[] = [];
    let totalDeleted = 0;

    // Create summaries for days that will be deleted
    const summaryDate = new Date();
    summaryDate.setDate(summaryDate.getDate() - 30);
    await createDailySummary(supabase, summaryDate.toISOString().split('T')[0]);

    // Cleanup each table
    for (const [tableName, retentionDays] of Object.entries(RETENTION_PERIODS)) {
      try {
        // Special handling for different date columns
        let dateColumn = 'created_at';
        if (tableName === 'health_checks') dateColumn = 'checked_at';
        if (tableName === 'affiliate_link_clicks') dateColumn = 'clicked_at';
        if (tableName === 'iptv_channel_metrics') dateColumn = 'recorded_at';

        const deletedCount = await cleanupTable(supabase, tableName, retentionDays, dateColumn);
        
        results.push({
          table: tableName,
          deletedCount,
          retentionDays,
          success: true,
        });
        
        totalDeleted += deletedCount;
        console.log(`[cleanup-old-logs] ${tableName}: deleted ${deletedCount} rows (>${retentionDays} days old)`);
      } catch (error) {
        results.push({
          table: tableName,
          deletedCount: 0,
          retentionDays,
          success: false,
          error: error.message,
        });
        console.error(`[cleanup-old-logs] Failed to cleanup ${tableName}:`, error.message);
      }
    }

    const durationMs = Date.now() - startTime;

    // Log cleanup activity
    await supabase.from('activity_logs').insert({
      action: 'scheduled_cleanup',
      entity_type: 'system',
      details: {
        tables_processed: results.length,
        total_deleted: totalDeleted,
        duration_ms: durationMs,
        results,
      },
    });

    const response = {
      success: true,
      totalDeleted,
      tablesProcessed: results.length,
      successCount: results.filter(r => r.success).length,
      failureCount: results.filter(r => !r.success).length,
      durationMs,
      results,
    };

    console.log(`[cleanup-old-logs] Completed: ${totalDeleted} rows deleted in ${durationMs}ms`);

    return new Response(
      JSON.stringify(response),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[cleanup-old-logs] Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
