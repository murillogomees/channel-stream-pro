import { supabase } from "@/integrations/supabase/client";

export interface RLSIssue {
  id: string;
  severity: 'high' | 'medium' | 'low';
  table: string;
  schema: string;
  action?: string;
  issue: string;
  evidence: string[];
  proposed_fix: {
    summary: string;
    sql_dry_run: string;
    sql_apply: string;
    rollback_sql: string;
  };
  estimated_effort: string;
}

export interface RLSCoverageReport {
  scan_id: string;
  timestamp: string;
  summary: {
    total_tables: number;
    tables_without_rls: number;
    permissive_policies: number;
    coverage_percentage: number;
    scan_timestamp: string;
  };
  issues: RLSIssue[];
  total_issues: number;
  by_severity: {
    high: number;
    medium: number;
    low: number;
  };
}

export interface FixResult {
  success: boolean;
  message?: string;
  error?: string;
  backup_id?: string;
  issue_id?: string;
  applied_by?: string;
  applied_at?: string;
  rollback_available?: boolean;
  requires_master?: boolean;
}

class RLSCoverageService {
  async runScan(): Promise<RLSCoverageReport> {
    const { data, error } = await supabase.functions.invoke('rls-coverage', {
      method: 'GET',
    });

    if (error) {
      console.error('Error running RLS scan:', error);
      throw new Error(`Failed to run RLS scan: ${error.message}`);
    }

    return data;
  }

  async getScanHistory(limit: number = 10): Promise<any[]> {
    const { data, error } = await supabase
      .from('rls_scan_results')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('Error fetching scan history:', error);
      throw error;
    }

    return data || [];
  }

  async applyFix(params: {
    issue_id: string;
    scan_result_id?: string;
    severity: string;
    schema_name: string;
    table_name: string;
    policy_name?: string;
    sql_apply: string;
    sql_rollback: string;
    dry_run?: boolean;
    confirm?: boolean;
  }): Promise<FixResult> {
    const { data, error } = await supabase.functions.invoke('rls-fix', {
      method: 'POST',
      body: params,
    });

    if (error) {
      console.error('Error applying RLS fix:', error);
      throw new Error(`Failed to apply fix: ${error.message}`);
    }

    return data;
  }

  async getFixBackups(tableFilter?: string): Promise<any[]> {
    let query = supabase
      .from('rls_fix_backups')
      .select('*')
      .order('backup_timestamp', { ascending: false });

    if (tableFilter) {
      query = query.eq('table_name', tableFilter);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching backups:', error);
      throw error;
    }

    return data || [];
  }

  async restoreFromBackup(backupId: string): Promise<{ success: boolean; message?: string; error?: string }> {
    // Get backup
    const { data: backup, error: backupError } = await supabase
      .from('rls_fix_backups')
      .select('*')
      .eq('id', backupId)
      .single();

    if (backupError || !backup) {
      throw new Error('Backup not found');
    }

    // Execute restore SQL
    // Note: This would need a dedicated edge function to execute raw SQL
    // For now, we'll return the SQL that should be executed manually
    return {
      success: false,
      message: 'Manual restore required. Execute the SQL below in your database.',
      error: backup.restore_sql,
    };
  }

  formatSeverityBadge(severity: string): { variant: 'destructive' | 'default' | 'secondary'; label: string } {
    switch (severity) {
      case 'high':
        return { variant: 'destructive', label: 'High' };
      case 'medium':
        return { variant: 'default', label: 'Medium' };
      case 'low':
        return { variant: 'secondary', label: 'Low' };
      default:
        return { variant: 'default', label: severity };
    }
  }

  formatIssueType(issueType: string): string {
    const types: Record<string, string> = {
      missing_policy: 'Missing Policy',
      permissive_policy: 'Permissive Policy',
      no_roles: 'No Roles Defined',
      mismatch: 'Policy Mismatch',
    };
    return types[issueType] || issueType;
  }
}

export const rlsCoverageService = new RLSCoverageService();