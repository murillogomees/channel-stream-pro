/**
 * Migration Automation Service
 * 
 * Manages schema drift detection and automatic fixes
 */

import { supabase } from '@/integrations/supabase/client';

export interface DriftFinding {
  id: string;
  object_type: string;
  object_name: string;
  drift_type: 'missing' | 'extra' | 'modified' | 'outdated';
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  current_state: string | null;
  expected_state: string | null;
  fix_sql: string;
  fix_applied: boolean;
  fix_applied_at: string | null;
  created_at: string;
  resolved_at: string | null;
  metadata: Record<string, any>;
}

export interface ScanSummary {
  scan_id: string;
  total_findings: number;
  critical: number;
  high: number;
  medium: number;
  low: number;
  by_type: Record<string, number>;
}

export interface ScanResult {
  success: boolean;
  scan_id: string;
  summary: ScanSummary;
  findings: DriftFinding[];
}

/**
 * Scan database for schema drift
 */
export async function scanForDrift(): Promise<ScanResult> {
  const { data, error } = await supabase.functions.invoke('scan-migrations', {
    method: 'POST'
  });

  if (error) {
    console.error('[Migration] Scan error:', error);
    throw new Error(`Failed to scan: ${error.message}`);
  }

  return data;
}

/**
 * Get recent drift findings
 */
export async function getRecentDriftFindings(limit: number = 50): Promise<DriftFinding[]> {
  const { data, error } = await supabase
    .from('schema_drift_log')
    .select('*')
    .is('resolved_at', null)
    .order('severity', { ascending: true }) // critical first
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('[Migration] Error fetching findings:', error);
    throw error;
  }

  return (data || []) as DriftFinding[];
}

/**
 * Apply a fix for a drift finding (dry run support)
 */
export async function applyFix(driftId: string, dryRun: boolean = false): Promise<{
  success: boolean;
  message?: string;
  execution_time_ms?: number;
  error?: string;
}> {
  const { data, error } = await supabase.functions.invoke('apply-migration-fix', {
    method: 'POST',
    body: { drift_id: driftId, dry_run: dryRun }
  });

  if (error) {
    console.error('[Migration] Apply fix error:', error);
    return {
      success: false,
      error: error.message
    };
  }

  return data;
}

/**
 * Get drift statistics
 */
export async function getDriftStats(): Promise<{
  total: number;
  critical: number;
  high: number;
  medium: number;
  low: number;
  resolved: number;
}> {
  const { data, error } = await supabase
    .from('schema_drift_log')
    .select('severity, resolved_at');

  if (error) {
    console.error('[Migration] Error fetching stats:', error);
    return {
      total: 0,
      critical: 0,
      high: 0,
      medium: 0,
      low: 0,
      resolved: 0
    };
  }

  const findings = data || [];
  
  return {
    total: findings.length,
    critical: findings.filter(f => f.severity === 'critical').length,
    high: findings.filter(f => f.severity === 'high').length,
    medium: findings.filter(f => f.severity === 'medium').length,
    low: findings.filter(f => f.severity === 'low').length,
    resolved: findings.filter(f => f.resolved_at !== null).length
  };
}

/**
 * Get migration tracking history
 */
export async function getMigrationHistory(limit: number = 50) {
  const { data, error } = await supabase
    .from('schema_migrations_tracking')
    .select('*')
    .order('applied_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('[Migration] Error fetching history:', error);
    throw error;
  }

  return data || [];
}

export const migrationAutomationService = {
  scanForDrift,
  getRecentDriftFindings,
  applyFix,
  getDriftStats,
  getMigrationHistory
};