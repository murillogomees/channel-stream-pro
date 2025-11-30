/**
 * useSecurityAudit Hook
 * 
 * Provides access to security audit functionality
 */

import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
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
      const { data, error: fnError } = await supabase.functions.invoke('security-audit', {
        body: null,
        headers: {},
      });
      
      // Handle the URL parameter approach
      const response = await fetch(
        `https://sdvyxdghxqmntyoweqbd.supabase.co/functions/v1/security-audit?type=${type}`,
        {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token || ''}`,
            'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNkdnl4ZGdoeHFtbnR5b3dlcWJkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjMwMzMxNTAsImV4cCI6MjA3ODYwOTE1MH0.60t5M81zC_UI5qr3Pfjy0Pa2AKqglMQu7RLmE0K2iak',
          },
        }
      );
      
      if (!response.ok) {
        throw new Error(`Audit failed: ${response.statusText}`);
      }
      
      const auditData = await response.json() as SecurityAuditReport;
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
