/**
 * ============================================================================
 * useWebVitals - Web Vitals Monitoring Hook
 * ============================================================================
 * 
 * Hook para monitorar Core Web Vitals da aplicação.
 */

import { useState, useEffect, useCallback } from 'react';
import { 
  webVitalsService, 
  WebVitalMetric, 
  WebVitalsReport,
  MetricName,
} from '@/services/webVitalsService';

interface UseWebVitalsOptions {
  onReport?: (report: WebVitalsReport) => void;
  autoInit?: boolean;
}

export function useWebVitals(options: UseWebVitalsOptions = {}) {
  const { onReport, autoInit = true } = options;

  const [metrics, setMetrics] = useState<Partial<Record<MetricName, WebVitalMetric>>>({});
  const [score, setScore] = useState(0);
  const [isInitialized, setIsInitialized] = useState(false);

  // Initialize
  useEffect(() => {
    if (!autoInit) return;

    webVitalsService.init((report) => {
      setMetrics(report.metrics);
      setScore(report.score);
      onReport?.(report);
    });

    setIsInitialized(true);

    // Update metrics periodically
    const interval = setInterval(() => {
      const currentMetrics = webVitalsService.getMetrics();
      setMetrics(currentMetrics);
      setScore(webVitalsService.calculateScore());
    }, 5000);

    return () => {
      clearInterval(interval);
    };
  }, [autoInit, onReport]);

  // Manual init
  const init = useCallback(() => {
    if (isInitialized) return;
    
    webVitalsService.init((report) => {
      setMetrics(report.metrics);
      setScore(report.score);
      onReport?.(report);
    });
    
    setIsInitialized(true);
  }, [isInitialized, onReport]);

  // Get current report
  const getReport = useCallback(() => {
    return webVitalsService.getReport();
  }, []);

  // Send report manually
  const sendReport = useCallback(() => {
    webVitalsService.sendReport();
  }, []);

  // Format helpers
  const formatValue = useCallback((name: MetricName, value: number) => {
    return webVitalsService.formatMetricValue(name, value);
  }, []);

  const getRatingColor = useCallback((rating: WebVitalMetric['rating']) => {
    return webVitalsService.getRatingColor(rating);
  }, []);

  const getScoreColor = useCallback((score: number) => {
    return webVitalsService.getScoreColor(score);
  }, []);

  return {
    // State
    metrics,
    score,
    isInitialized,

    // Individual metrics
    lcp: metrics.LCP,
    fid: metrics.FID,
    cls: metrics.CLS,
    fcp: metrics.FCP,
    ttfb: metrics.TTFB,

    // Actions
    init,
    getReport,
    sendReport,

    // Helpers
    formatValue,
    getRatingColor,
    getScoreColor,
  };
}

export default useWebVitals;
