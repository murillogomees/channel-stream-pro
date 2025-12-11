/**
 * useSecurityAudit Hook
 * 
 * Provides access to security audit functionality
 */

import { useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';

export interface SecurityFinding {
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  category: string;
  title: string;
  description: string;
  remediation?: string;
  evidence?: Record<string, unknown>;
}

export interface SecurityAuditReport {
  timestamp: string;
  audit_type: string;
  overall_score: number;
  findings: SecurityFinding[];
  summary: {
    critical: number;
    high: number;
    medium: number;
    low: number;
    info: number;
  };
  recommendations: string[];
}

export function useSecurityAudit() {
  const [report, setReport] = useState<SecurityAuditReport | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const runAudit = useCallback(async (
    type: 'full' | 'tokens' | 'hotlink' | 'ratelimit' | 'blacklist' | 'secrets' | 'cors' | 'auth' | 'payment' = 'full'
  ): Promise<SecurityAuditReport | null> => {
    setIsLoading(true);
    setError(null);
    
    try {
      // Use Supabase client instead of hardcoded URLs/keys
      const { data: responseData, error: fnError } = await supabase.functions.invoke('security-audit', {
        body: { type },
      });
      
      if (fnError) {
        throw new Error(fnError.message);
      }
      
      const auditData = responseData as SecurityAuditReport;
      setReport(auditData);
      
      // Show toast based on score
      if (auditData.overall_score >= 80) {
        toast.success(`Security Score: ${auditData.overall_score}/100`);
      } else if (auditData.overall_score >= 50) {
        toast.warning(`Security Score: ${auditData.overall_score}/100 - Review findings`);
      } else {
        toast.error(`Security Score: ${auditData.overall_score}/100 - Action required`);
      }
      
      return auditData;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
      toast.error(`Audit failed: ${errorMessage}`);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const getSeverityColor = (severity: SecurityFinding['severity']): string => {
    switch (severity) {
      case 'critical': return 'text-red-600 bg-red-100';
      case 'high': return 'text-orange-600 bg-orange-100';
      case 'medium': return 'text-yellow-600 bg-yellow-100';
      case 'low': return 'text-blue-600 bg-blue-100';
      case 'info': return 'text-gray-600 bg-gray-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const getScoreColor = (score: number): string => {
    if (score >= 80) return 'text-green-600';
    if (score >= 50) return 'text-yellow-600';
    return 'text-red-600';
  };

  return {
    report,
    isLoading,
    error,
    runAudit,
    getSeverityColor,
    getScoreColor,
  };
}

export default useSecurityAudit;
