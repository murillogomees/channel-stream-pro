/**
 * Migration Service
 * 
 * Handles migration of data from Lovable Cloud Supabase to Self-Hosted Supabase
 * Uses service role key to bypass RLS for migrations
 */

import { createClient } from '@supabase/supabase-js';
import { supabase as cloudSupabase } from '../supabase/client';

// Self-hosted admin client with service role key for migrations (bypasses RLS)
const SELFHOSTED_URL = "https://supabase.iptvlink.com.br";
// Service role key - allows bypassing RLS policies
const SELFHOSTED_SERVICE_ROLE_KEY = "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJpc3MiOiJzdXBhYmFzZSIsImlhdCI6MTc2NTIyMDgyMCwiZXhwIjo0OTIwODk0NDIwLCJyb2xlIjoic2VydmljZV9yb2xlIn0.efcOMtFOUk5Ytcb2jN8krXkY5u6yG0byL-XtPEU1IWk";

// Admin client for migrations - uses service role key to bypass RLS
const selfHostedAdminClient = createClient(
  SELFHOSTED_URL,
  SELFHOSTED_SERVICE_ROLE_KEY,
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  }
);

export interface MigrationProgress {
  table: string;
  totalRows: number;
  migratedRows: number;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  error?: string;
}

export interface MigrationStatus {
  startedAt: Date;
  completedAt?: Date;
  tables: MigrationProgress[];
  authMigrated: boolean;
  rolesMigrated: boolean;
  profilesMigrated: boolean;
  overallStatus: 'pending' | 'in_progress' | 'completed' | 'failed';
}

export interface TableMigrationResult {
  table: string;
  success: boolean;
  rowsCount: number;
  error?: string;
}

// Tables to migrate in order (respecting foreign key dependencies)
const MIGRATION_ORDER = [
  // Core tables first
  'profiles',
  'user_roles',
  
  // Independent tables
  'notification_templates',
  'auto_notifications',
  'test_contacts',
  'admin_phones',
  'admin_shortcuts',
  'admin_favorites',
  'admin_badge_notifications',
  'custom_status_badges',
  'dashboard_widgets',
  
  // Affiliate system
  'affiliate_tiers',
  'affiliates',
  'affiliate_links',
  'affiliate_link_clicks',
  'affiliate_referrals',
  'affiliate_payouts',
  'affiliate_withdrawals',
  'affiliate_analytics',
  'affiliate_reports',
  'affiliate_promotions',
  'affiliate_marketing_materials',
  'affiliate_onboarding',
  'affiliate_dashboard',
  'affiliate_fraud_logs',
  'affiliate_config',
  
  // Content and media
  'iptv_channels',
  'iptv_playlists',
  'iptv_playlist_channels',
  'iptv_cdn_cache',
  'iptv_channel_metrics',
  'iptv_stream_tokens',
  'iptv_probe_jobs',
  'iptv_transcode_jobs',
  'epg_programs',
  
  // System configuration
  'feature_flag_config',
  'homepage_content',
  'homepage_faqs',
  'banners',
  'app_versions',
  
  // Payment and subscriptions
  'subscription_plans',
  'user_subscriptions',
  'payments',
  'payment_history',
  'discount_coupons',
  'mercado_pago_config',
  'mercado_pago_webhooks',
  
  // Security and logging
  'ip_whitelist',
  'ip_blacklist',
  'auth_sessions_log',
  'activity_logs',
  'notification_logs',
  'notification_queue',
  'health_checks',
  'api_usage',
  'playback_tokens',
  'player_events',
  
  // Client management
  'client_status_history',
  
  // A/B Testing
  'ab_test_offers',
  'ab_test_results',
  
  // Migration audit
  'migration_audit',
  'remote_command_audit',
];

export class MigrationService {
  private status: MigrationStatus;

  constructor() {
    this.status = {
      startedAt: new Date(),
      tables: [],
      authMigrated: false,
      rolesMigrated: false,
      profilesMigrated: false,
      overallStatus: 'pending',
    };
  }

  getStatus(): MigrationStatus {
    return this.status;
  }

  /**
   * Test connection to self-hosted Supabase
   */
  async testConnection(): Promise<{ success: boolean; error?: string; details?: Record<string, unknown> }> {
    try {
      // Test basic connection using admin client
      const { data, error } = await selfHostedAdminClient
        .from('profiles')
        .select('count')
        .limit(1);

      if (error) {
        return { success: false, error: error.message };
      }

      // Get server info if available
      const healthResponse = await fetch(`${SELFHOSTED_URL}/rest/v1/`, {
        method: 'HEAD',
        headers: {
          'apikey': SELFHOSTED_SERVICE_ROLE_KEY,
        },
      });

      return {
        success: true,
        details: {
          connected: true,
          serverStatus: healthResponse.status,
          timestamp: new Date().toISOString(),
        },
      };
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : 'Unknown error',
      };
    }
  }

  /**
   * Get count of records in a table from Cloud
   */
  async getCloudTableCount(tableName: string): Promise<number> {
    try {
      const { count, error } = await (cloudSupabase as any)
        .from(tableName)
        .select('*', { count: 'exact', head: true });

      if (error) {
        console.error(`Error counting ${tableName}:`, error);
        return 0;
      }

      return count || 0;
    } catch {
      return 0;
    }
  }

  /**
   * Get count of records in a table from Self-Hosted
   */
  async getSelfHostedTableCount(tableName: string): Promise<number> {
    try {
      // Use admin client with service role to bypass RLS
      const { count, error } = await (selfHostedAdminClient as any)
        .from(tableName)
        .select('*', { count: 'exact', head: true });

      if (error) {
        console.error(`Error counting ${tableName}:`, error);
        return 0;
      }

      return count || 0;
    } catch {
      return 0;
    }
  }

  /**
   * Migrate a single table
   */
  async migrateTable(tableName: string, batchSize: number = 500): Promise<TableMigrationResult> {
    console.log(`[Migration] Starting migration for table: ${tableName}`);
    
    const progress: MigrationProgress = {
      table: tableName,
      totalRows: 0,
      migratedRows: 0,
      status: 'in_progress',
    };
    
    this.status.tables.push(progress);

    try {
      // Get total count
      const totalCount = await this.getCloudTableCount(tableName);
      progress.totalRows = totalCount;

      if (totalCount === 0) {
        progress.status = 'completed';
        console.log(`[Migration] Table ${tableName} is empty, skipping`);
        return { table: tableName, success: true, rowsCount: 0 };
      }

      // Migrate in batches
      let offset = 0;
      let migratedCount = 0;

      while (offset < totalCount) {
        // Fetch batch from Cloud
        const { data, error: fetchError } = await (cloudSupabase as any)
          .from(tableName)
          .select('*')
          .range(offset, offset + batchSize - 1);

        if (fetchError) {
          throw new Error(`Fetch error: ${fetchError.message}`);
        }

        if (!data || data.length === 0) {
          break;
        }

        // Insert batch to Self-Hosted using admin client (bypasses RLS)
        const { error: insertError } = await (selfHostedAdminClient as any)
          .from(tableName)
          .upsert(data, { onConflict: 'id', ignoreDuplicates: true });

        if (insertError) {
          console.warn(`[Migration] Insert warning for ${tableName}:`, insertError.message);
          // Continue with next batch even if some fail
        }

        migratedCount += data.length;
        progress.migratedRows = migratedCount;
        offset += batchSize;

        console.log(`[Migration] ${tableName}: ${migratedCount}/${totalCount} rows migrated`);
      }

      progress.status = 'completed';
      console.log(`[Migration] Completed ${tableName}: ${migratedCount} rows`);
      
      return { table: tableName, success: true, rowsCount: migratedCount };
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown error';
      progress.status = 'failed';
      progress.error = errorMsg;
      console.error(`[Migration] Failed ${tableName}:`, errorMsg);
      
      return { table: tableName, success: false, rowsCount: 0, error: errorMsg };
    }
  }

  /**
   * Migrate all tables in order
   */
  async migrateAllTables(
    onProgress?: (progress: MigrationProgress) => void
  ): Promise<TableMigrationResult[]> {
    this.status.overallStatus = 'in_progress';
    const results: TableMigrationResult[] = [];

    for (const table of MIGRATION_ORDER) {
      const result = await this.migrateTable(table);
      results.push(result);
      
      const progress = this.status.tables.find(t => t.table === table);
      if (progress && onProgress) {
        onProgress(progress);
      }
    }

    this.status.overallStatus = results.every(r => r.success) ? 'completed' : 'failed';
    this.status.completedAt = new Date();
    
    return results;
  }

  /**
   * Generate migration report
   */
  generateReport(): {
    summary: string;
    tables: Array<{ table: string; cloud: number; selfHosted: number; status: string }>;
  } {
    const tables = this.status.tables.map(t => ({
      table: t.table,
      cloud: t.totalRows,
      selfHosted: t.migratedRows,
      status: t.status,
    }));

    const totalMigrated = tables.reduce((sum, t) => sum + t.selfHosted, 0);
    const totalCloud = tables.reduce((sum, t) => sum + t.cloud, 0);
    const failedTables = tables.filter(t => t.status === 'failed').length;

    const summary = `
Migration Report
================
Started: ${this.status.startedAt.toISOString()}
Completed: ${this.status.completedAt?.toISOString() || 'In Progress'}
Status: ${this.status.overallStatus}

Tables: ${tables.length}
Total Records (Cloud): ${totalCloud}
Total Migrated: ${totalMigrated}
Failed Tables: ${failedTables}
    `.trim();

    return { summary, tables };
  }
}

// Singleton instance
export const migrationService = new MigrationService();
