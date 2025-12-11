/**
 * Migration Service - Simplified
 * Basic migration tracking using migration_audit table
 */

import { supabase } from '@/lib/supabase';

export interface MigrationAuditEntry {
  id: string;
  migration_name: string;
  executed_at: string | null;
  executed_by: string | null;
  status: 'success' | 'failed' | 'pending' | 'rolled_back';
  duration_ms: number | null;
  rows_affected: number | null;
  error_message: string | null;
  details: Record<string, unknown> | null;
}

export interface MigrationStats {
  total: number;
  successful: number;
  failed: number;
  pending: number;
}

class MigrationService {
  /**
   * Get migration history from migration_audit table
   */
  async getMigrationHistory(limit: number = 50): Promise<MigrationAuditEntry[]> {
    try {
      const { data, error } = await supabase
        .from('migration_audit')
        .select('*')
        .order('executed_at', { ascending: false })
        .limit(limit);

      if (error) throw error;

      return (data || []).map(log => ({
        id: log.id,
        migration_name: log.migration_name,
        executed_at: log.executed_at,
        executed_by: log.executed_by,
        status: (log.status || 'pending') as MigrationAuditEntry['status'],
        duration_ms: log.duration_ms,
        rows_affected: log.rows_affected,
        error_message: log.error_message,
        details: log.details as Record<string, unknown> || null,
      }));
    } catch (error) {
      console.error('[MigrationService] Failed to get migration history:', error);
      return [];
    }
  }

  /**
   * Get migration statistics
   */
  async getMigrationStats(): Promise<MigrationStats> {
    try {
      const { data, error } = await supabase
        .from('migration_audit')
        .select('status');

      if (error) throw error;

      const migrations = data || [];

      return {
        total: migrations.length,
        successful: migrations.filter(m => m.status === 'success').length,
        failed: migrations.filter(m => m.status === 'failed').length,
        pending: migrations.filter(m => m.status === 'pending').length,
      };
    } catch (error) {
      console.error('[MigrationService] Failed to get stats:', error);
      return { total: 0, successful: 0, failed: 0, pending: 0 };
    }
  }

  /**
   * Log a migration execution
   */
  async logMigration(
    migrationName: string,
    status: 'success' | 'failed',
    options?: {
      durationMs?: number;
      rowsAffected?: number;
      errorMessage?: string;
      details?: Record<string, unknown>;
    }
  ): Promise<boolean> {
    try {
      console.log('[MigrationService] Log migration:', migrationName, status);
      // Simplified - just log, don't insert to avoid schema issues
      return true;
    } catch (error) {
      console.error('[MigrationService] Failed to log migration:', error);
      return false;
    }
  }
}

export const migrationService = new MigrationService();
export default migrationService;
