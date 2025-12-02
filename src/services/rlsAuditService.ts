import { supabase } from '@/integrations/supabase/client';

export interface RLSPolicy {
  schemaname: string;
  tablename: string;
  policyname: string;
  permissive: string;
  roles: string[];
  cmd: string;
  qual: string | null;
  with_check: string | null;
}

export interface RLSIssue {
  severity: 'critical' | 'high' | 'medium' | 'low';
  table: string;
  issue: string;
  recommendation: string;
  policy_name?: string;
  policy_definition?: string;
}

export interface RLSAuditResult {
  timestamp: string;
  summary: {
    tables_without_rls: number;
    permissive_policies: number;
    total_policies: number;
    security_score: number;
  };
  issues: RLSIssue[];
  status: 'critical' | 'warning' | 'healthy';
}

export class RLSAuditService {
  async getAllPolicies(): Promise<RLSPolicy[]> {
    const { data, error } = await supabase.rpc('get_all_rls_policies');
    
    if (error) {
      console.error('Error fetching RLS policies:', error);
      throw error;
    }
    
    return (data as any) || [];
  }

  async getTablesWithoutRLS(): Promise<string[]> {
    const { data, error } = await supabase.rpc('get_tables_without_rls');
    
    if (error) {
      console.error('Error fetching tables without RLS:', error);
      throw error;
    }
    
    return (data || []).map((t: any) => t.tablename);
  }

  async runCompleteAudit(): Promise<RLSAuditResult> {
    const { data, error } = await supabase.rpc('run_complete_rls_audit');
    
    if (error) {
      console.error('Error running RLS audit:', error);
      throw error;
    }
    
    return data as unknown as RLSAuditResult;
  }

  async detectPermissivePolicies() {
    const { data, error } = await supabase.rpc('detect_permissive_rls_policies');
    
    if (error) {
      console.error('Error detecting permissive policies:', error);
      throw error;
    }
    
    return data || [];
  }

  analyzePolicies(policies: RLSPolicy[]): RLSIssue[] {
    const issues: RLSIssue[] = [];

    policies.forEach(policy => {
      const qualLower = policy.qual?.toLowerCase() || '';
      const withCheckLower = policy.with_check?.toLowerCase() || '';
      
      // Check for overly permissive USING
      if (qualLower === 'true' || qualLower === '(true)') {
        issues.push({
          severity: 'critical',
          table: policy.tablename,
          policy_name: policy.policyname,
          issue: 'Política USING sempre verdadeira - acesso irrestrito',
          recommendation: 'Adicione condições específicas baseadas em auth.uid() ou has_role()',
          policy_definition: policy.qual || ''
        });
      }

      // Check for overly permissive WITH CHECK
      if (withCheckLower === 'true' || withCheckLower === '(true)') {
        issues.push({
          severity: 'high',
          table: policy.tablename,
          policy_name: policy.policyname,
          issue: 'WITH CHECK sempre verdadeiro - validação fraca',
          recommendation: 'Adicione validações específicas no WITH CHECK',
          policy_definition: policy.with_check || ''
        });
      }

      // Check for missing WITH CHECK on INSERT/UPDATE
      if ((policy.cmd === 'INSERT' || policy.cmd === 'UPDATE' || policy.cmd === 'ALL') && !policy.with_check) {
        issues.push({
          severity: 'medium',
          table: policy.tablename,
          policy_name: policy.policyname,
          issue: `${policy.cmd} sem cláusula WITH CHECK`,
          recommendation: 'Adicione WITH CHECK para validar dados inseridos/atualizados'
        });
      }

      // Check for potential recursion (self-reference in policy)
      if (policy.qual && policy.qual.toLowerCase().includes(policy.tablename.toLowerCase())) {
        issues.push({
          severity: 'high',
          table: policy.tablename,
          policy_name: policy.policyname,
          issue: 'Possível recursão - política referencia a própria tabela',
          recommendation: 'Use uma função SECURITY DEFINER para evitar recursão',
          policy_definition: policy.qual
        });
      }
    });

    return issues;
  }
}

export const rlsAuditService = new RLSAuditService();
