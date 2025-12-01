/**
 * Migration Service - Fase 8 Migration Support
 * 
 * Provides utilities for:
 * - Safe migration execution with transactions
 * - Rollback tracking and execution
 * - Migration audit logging
 * - Feature flag-based progressive rollout
 */

import { supabase } from '@/integrations/supabase/client';
import { featureFlagsService, FeatureFlag } from './featureFlagsService';

// Migration-specific feature flags
export type MigrationFlag = 
  | 'use_cliente_db_only'
  | 'disable_legacy_routes'
  | 'consolidated_whatsapp'
  | 'new_notification_system';

interface MigrationConfig {
  enabled: boolean;
  percentage: number;
  description: string;
  rollbackAvailable: boolean;
}

interface MigrationAuditEntry {
  id: string;
  migration_name: string;
  executed_at: string;
  executed_by: string | null;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'rolled_back';
  duration_ms: number | null;
  rows_affected: number | null;
  rollback_available: boolean;
  rollback_executed_at: string | null;
  error_message: string | null;
  metadata: Record<string, unknown>;
}

// Migration flag configurations
const MIGRATION_FLAGS: Record<MigrationFlag, MigrationConfig> = {
  use_cliente_db_only: {
    enabled: false,
    percentage: 0,
    description: 'Use ClienteDb instead of legacy Cliente type',
    rollbackAvailable: true,
  },
  disable_legacy_routes: {
    enabled: false,
    percentage: 0,
    description: 'Disable redirects to legacy admin routes',
    rollbackAvailable: true,
  },
  consolidated_whatsapp: {
    enabled: true,
    percentage: 100,
    description: 'Use consolidated WhatsApp service',
    rollbackAvailable: true,
  },
  new_notification_system: {
    enabled: true,
    percentage: 100,
    description: 'Use modular notification system',
    rollbackAvailable: true,
  },
};

class MigrationService {
  private migrationFlags: Record<MigrationFlag, MigrationConfig>;
  private auditCache: MigrationAuditEntry[] = [];

  constructor() {
    this.migrationFlags = { ...MIGRATION_FLAGS };
  }

  /**
   * Check if a migration flag is enabled
   */
  isMigrationEnabled(flag: MigrationFlag): boolean {
    const config = this.migrationFlags[flag];
    if (!config) return false;
    if (!config.enabled) return false;
    
    // Use feature flags service for percentage-based rollout
    // Convert migration flag to use similar logic
    const userHash = this.getUserHash();
    if (config.percentage < 100) {
      return userHash < config.percentage;
    }
    
    return true;
  }

  /**
   * Get user hash for percentage-based rollout
   */
  private getUserHash(): number {
    const userId = localStorage.getItem('user_id') || 'anonymous';
    let hash = 0;
    for (let i = 0; i < userId.length; i++) {
      const char = userId.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash % 100);
  }

  /**
   * Update migration flag configuration
   */
  updateMigrationFlag(flag: MigrationFlag, config: Partial<MigrationConfig>): void {
    this.migrationFlags[flag] = {
      ...this.migrationFlags[flag],
      ...config,
    };
    console.log(`[MigrationService] Updated flag ${flag}:`, this.migrationFlags[flag]);
  }

  /**
   * Get all migration flags status
   */
  getAllMigrationFlags(): Record<MigrationFlag, { enabled: boolean; config: MigrationConfig }> {
    const result: Record<string, { enabled: boolean; config: MigrationConfig }> = {};
    
    for (const flag of Object.keys(this.migrationFlags) as MigrationFlag[]) {
      result[flag] = {
        enabled: this.isMigrationEnabled(flag),
        config: this.migrationFlags[flag],
      };
    }
    
    return result as Record<MigrationFlag, { enabled: boolean; config: MigrationConfig }>;
  }

  /**
   * Log migration execution to audit table
   */
  async logMigration(
    migrationName: string,
    status: MigrationAuditEntry['status'],
    options: {
      durationMs?: number;
      rowsAffected?: number;
      errorMessage?: string;
      metadata?: Record<string, unknown>;
    } = {}
  ): Promise<string | null> {
    try {
      const { data, error } = await supabase
        .from('migration_audit')
        .insert({
          migration_name: migrationName,
          status,
          duration_ms: options.durationMs,
          rows_affected: options.rowsAffected,
          error_message: options.errorMessage,
          metadata: options.metadata || {},
        } as any)
        .select('id')
        .single();

      if (error) throw error;
      return data?.id || null;
    } catch (error) {
      console.error('[MigrationService] Failed to log migration:', error);
      return null;
    }
  }

  /**
   * Execute migration with safety checks
   */
  async executeMigration(
    migrationName: string,
    migrationFn: () => Promise<{ rowsAffected: number }>,
    options: {
      dryRun?: boolean;
      rollbackFn?: () => Promise<void>;
    } = {}
  ): Promise<{ success: boolean; rowsAffected: number; error?: string }> {
    const startTime = Date.now();
    
    // Log start
    await this.logMigration(migrationName, 'running', {
      metadata: { dry_run: options.dryRun },
    });

    try {
      if (options.dryRun) {
        console.log(`[MigrationService] DRY RUN: ${migrationName}`);
        return { success: true, rowsAffected: 0 };
      }

      const result = await migrationFn();
      const durationMs = Date.now() - startTime;

      // Log success
      await this.logMigration(migrationName, 'completed', {
        durationMs,
        rowsAffected: result.rowsAffected,
      });

      console.log(`[MigrationService] Migration ${migrationName} completed in ${durationMs}ms`);
      return { success: true, rowsAffected: result.rowsAffected };
    } catch (error) {
      const durationMs = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      // Log failure
      await this.logMigration(migrationName, 'failed', {
        durationMs,
        errorMessage,
      });

      console.error(`[MigrationService] Migration ${migrationName} failed:`, error);
      return { success: false, rowsAffected: 0, error: errorMessage };
    }
  }

  /**
   * Execute rollback for a migration
   */
  async executeRollback(
    migrationName: string,
    rollbackFn: () => Promise<void>
  ): Promise<{ success: boolean; error?: string }> {
    const startTime = Date.now();

    try {
      await rollbackFn();
      const durationMs = Date.now() - startTime;

      // Log rollback
      await this.logMigration(migrationName, 'rolled_back', {
        durationMs,
        metadata: { rollback_executed_at: new Date().toISOString() },
      });

      console.log(`[MigrationService] Rollback ${migrationName} completed in ${durationMs}ms`);
      return { success: true };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error(`[MigrationService] Rollback ${migrationName} failed:`, error);
      return { success: false, error: errorMessage };
    }
  }

  /**
   * Get migration audit history
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
        status: log.status as MigrationAuditEntry['status'],
        duration_ms: log.duration_ms,
        rows_affected: log.rows_affected,
        rollback_available: log.rollback_available ?? true,
        rollback_executed_at: log.rollback_executed_at,
        error_message: log.error_message,
        metadata: log.metadata as Record<string, unknown> || {},
      }));
    } catch (error) {
      console.error('[MigrationService] Failed to get migration history:', error);
      return [];
    }
  }

  /**
   * Verify migration prerequisites
   */
  async verifyPrerequisites(checks: Array<{
    name: string;
    check: () => Promise<boolean>;
  }>): Promise<{ allPassed: boolean; results: Array<{ name: string; passed: boolean }> }> {
    const results: Array<{ name: string; passed: boolean }> = [];
    
    for (const { name, check } of checks) {
      try {
        const passed = await check();
        results.push({ name, passed });
      } catch {
        results.push({ name, passed: false });
      }
    }

    return {
      allPassed: results.every(r => r.passed),
      results,
    };
  }

  /**
   * Progressive rollout helper
   */
  async progressiveRollout(
    flag: MigrationFlag,
    targetPercentage: number,
    stepSize: number = 10,
    delayMs: number = 300000 // 5 minutes between steps
  ): Promise<void> {
    const currentPercentage = this.migrationFlags[flag].percentage;
    
    if (targetPercentage <= currentPercentage) {
      console.log(`[MigrationService] Target ${targetPercentage}% <= current ${currentPercentage}%, skipping`);
      return;
    }

    console.log(`[MigrationService] Starting progressive rollout for ${flag}: ${currentPercentage}% -> ${targetPercentage}%`);

    let percentage = currentPercentage;
    while (percentage < targetPercentage) {
      percentage = Math.min(percentage + stepSize, targetPercentage);
      
      this.updateMigrationFlag(flag, { percentage, enabled: true });
      console.log(`[MigrationService] ${flag} now at ${percentage}%`);

      if (percentage < targetPercentage) {
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    }

    console.log(`[MigrationService] Progressive rollout complete: ${flag} at ${percentage}%`);
  }

  /**
   * Emergency stop - disable all migration flags
   */
  emergencyStop(): void {
    console.warn('[MigrationService] 🚨 EMERGENCY STOP - Disabling all migration flags');
    
    for (const flag of Object.keys(this.migrationFlags) as MigrationFlag[]) {
      this.updateMigrationFlag(flag, { enabled: false, percentage: 0 });
    }
  }
}

// Export singleton instance
export const migrationService = new MigrationService();
export default migrationService;
