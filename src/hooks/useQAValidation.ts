/**
 * useQAValidation Hook
 * 
 * Provides access to QA validation functionality
 */

import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface ValidationResult {
  test: string;
  status: 'pass' | 'fail' | 'warn' | 'skip';
  duration_ms: number;
  details?: Record<string, unknown>;
  error?: string;
}

export interface QAReport {
  timestamp: string;
  overall_status: 'pass' | 'fail' | 'partial';
  total_tests: number;
  passed: number;
  failed: number;
  warnings: number;
  results: ValidationResult[];
  metrics: {
    startup_p50_ms?: number;
    startup_p95_ms?: number;
    segment_p50_ms?: number;
    segment_p95_ms?: number;
    cache_hit_rate?: number;
    error_rate?: number;
  };
}

type ValidationAction = 'full' | 'manifest' | 'transcode' | 'security' | 'ratelimit' | 'cache' | 'rls' | 'cors' | 'metrics' | 'access';

export function useQAValidation() {
  const [report, setReport] = useState<QAReport | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const runValidation = useCallback(async (action: ValidationAction = 'full'): Promise<QAReport | null> => {
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await fetch(
        `https://sdvyxdghxqmntyoweqbd.supabase.co/functions/v1/qa-validation?action=${action}`,
        {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token || ''}`,
            'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNkdnl4ZGdoeHFtbnR5b3dlcWJkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjMwMzMxNTAsImV4cCI6MjA3ODYwOTE1MH0.60t5M81zC_UI5qr3Pfjy0Pa2AKqglMQu7RLmE0K2iak',
          },
        }
      );
      
      if (!response.ok) {
        throw new Error(`Validation failed: ${response.statusText}`);
      }
      
      const data = await response.json() as QAReport;
      setReport(data);
      
      // Show toast based on status
      if (data.overall_status === 'pass') {
        toast.success(`QA Validation: ${data.passed}/${data.total_tests} tests passed`);
      } else if (data.overall_status === 'partial') {
        toast.warning(`QA Validation: ${data.warnings} warnings`);
      } else {
        toast.error(`QA Validation: ${data.failed} tests failed`);
      }
      
      return data;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
      toast.error(`Validation failed: ${errorMessage}`);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const getStatusColor = (status: ValidationResult['status']): string => {
    switch (status) {
      case 'pass': return 'text-green-600 bg-green-100';
      case 'fail': return 'text-red-600 bg-red-100';
      case 'warn': return 'text-yellow-600 bg-yellow-100';
      case 'skip': return 'text-gray-600 bg-gray-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const getStatusIcon = (status: ValidationResult['status']): string => {
    switch (status) {
      case 'pass': return '✓';
      case 'fail': return '✗';
      case 'warn': return '⚠';
      case 'skip': return '○';
      default: return '?';
    }
  };

  return {
    report,
    isLoading,
    error,
    runValidation,
    getStatusColor,
    getStatusIcon,
  };
}

export default useQAValidation;
