/**
 * Scheduled Backup Edge Function
 * 
 * Runs daily via pg_cron to create database backups
 * Uploads backup to R2 Storage for disaster recovery
 * 
 * Schedule: Daily at 3:00 AM
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';
import { S3Client, PutObjectCommand } from 'https://esm.sh/@aws-sdk/client-s3@3.540.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const CRON_SECRET = Deno.env.get('CRON_SECRET');

// R2 Configuration
const R2_ACCOUNT_ID = Deno.env.get('R2_ACCOUNT_ID');
const R2_ACCESS_KEY_ID = Deno.env.get('R2_ACCESS_KEY_ID');
const R2_SECRET_ACCESS_KEY = Deno.env.get('R2_SECRET_ACCESS_KEY');
const R2_BUCKET_NAME = Deno.env.get('R2_BUCKET_NAME') || 'iptvlink-cdn';

// Tables to backup (in priority order)
const BACKUP_TABLES = [
  'profiles',
  'user_roles',
  'subscription_plans',
  'user_subscriptions',
  'payments',
  'notification_templates',
  'auto_notifications',
  'notification_logs',
  'iptv_playlists',
  'iptv_playlist_channels',
  'discount_coupons',
  'affiliates',
  'affiliate_referrals',
];

interface BackupResult {
  table: string;
  rowCount: number;
  success: boolean;
  error?: string;
}

async function backupTable(
  supabase: ReturnType<typeof createClient>,
  tableName: string
): Promise<{ data: unknown[]; count: number }> {
  const { data, error, count } = await supabase
    .from(tableName)
    .select('*', { count: 'exact' })
    .limit(50000); // Safety limit

  if (error) throw error;
  
  return { data: data || [], count: count || 0 };
}

async function uploadToR2(key: string, data: string): Promise<void> {
  if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY) {
    console.log('[scheduled-backup] R2 not configured, skipping upload');
    return;
  }

  const s3 = new S3Client({
    region: 'auto',
    endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: R2_ACCESS_KEY_ID,
      secretAccessKey: R2_SECRET_ACCESS_KEY,
    },
  });

  await s3.send(new PutObjectCommand({
    Bucket: R2_BUCKET_NAME,
    Key: key,
    Body: data,
    ContentType: 'application/json',
  }));

  console.log(`[scheduled-backup] Uploaded to R2: ${key}`);
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
    const timestamp = new Date().toISOString().split('T')[0];
    const backupId = `backup-${timestamp}-${Date.now()}`;
    
    console.log(`[scheduled-backup] Starting backup: ${backupId}`);

    const results: BackupResult[] = [];
    const fullBackup: Record<string, unknown[]> = {};

    // Backup each table
    for (const tableName of BACKUP_TABLES) {
      try {
        const { data, count } = await backupTable(supabase, tableName);
        fullBackup[tableName] = data;
        results.push({
          table: tableName,
          rowCount: count,
          success: true,
        });
        console.log(`[scheduled-backup] Backed up ${tableName}: ${count} rows`);
      } catch (error) {
        results.push({
          table: tableName,
          rowCount: 0,
          success: false,
          error: error.message,
        });
        console.error(`[scheduled-backup] Failed to backup ${tableName}:`, error);
      }
    }

    // Create backup metadata
    const backupMetadata = {
      id: backupId,
      timestamp: new Date().toISOString(),
      tables: results,
      totalRows: results.reduce((sum, r) => sum + r.rowCount, 0),
      successCount: results.filter(r => r.success).length,
      failureCount: results.filter(r => !r.success).length,
      durationMs: Date.now() - startTime,
    };

    // Prepare backup JSON
    const backupJson = JSON.stringify({
      metadata: backupMetadata,
      data: fullBackup,
    }, null, 2);

    // Upload to R2
    const r2Key = `backups/${timestamp}/${backupId}.json`;
    await uploadToR2(r2Key, backupJson);

    // Also save backup record to database
    await supabase.from('activity_logs').insert({
      action: 'scheduled_backup',
      entity_type: 'system',
      entity_id: backupId,
      details: backupMetadata,
    });

    const response = {
      success: true,
      backupId,
      r2Key,
      metadata: backupMetadata,
    };

    console.log(`[scheduled-backup] Completed in ${backupMetadata.durationMs}ms`);

    return new Response(
      JSON.stringify(response),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[scheduled-backup] Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
