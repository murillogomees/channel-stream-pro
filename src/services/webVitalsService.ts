/**
 * ============================================================================
 * Web Vitals Service - Performance Monitoring
 * ============================================================================
 * 
 * Monitora métricas de Core Web Vitals:
 * - LCP (Largest Contentful Paint)
 * - FID (First Input Delay) / INP (Interaction to Next Paint)
 * - CLS (Cumulative Layout Shift)
 * - FCP (First Contentful Paint)
 * - TTFB (Time to First Byte)
 */

// =============================================================================
// TYPES
// =============================================================================

export type MetricName = 'LCP' | 'FID' | 'INP' | 'CLS' | 'FCP' | 'TTFB';
export type MetricRating = 'good' | 'needs-improvement' | 'poor';

export interface WebVitalMetric {
  name: MetricName;
  value: number;
  rating: MetricRating;
  delta: number;
  id: string;
  navigationType: string;
  timestamp: number;
}

export interface WebVitalsReport {
  url: string;
  timestamp: number;
  metrics: Partial<Record<MetricName, WebVitalMetric>>;
  deviceType: string;
  connectionType: string;
  score: number;
}

export interface WebVitalsThresholds {
  LCP: { good: number; poor: number };
  FID: { good: number; poor: number };
  INP: { good: number; poor: number };
  CLS: { good: number; poor: number };
  FCP: { good: number; poor: number };
  TTFB: { good: number; poor: number };
}

// =============================================================================
// THRESHOLDS (Google Core Web Vitals)
// =============================================================================

const THRESHOLDS: WebVitalsThresholds = {
  LCP: { good: 2500, poor: 4000 },      // ms
  FID: { good: 100, poor: 300 },        // ms
  INP: { good: 200, poor: 500 },        // ms
  CLS: { good: 0.1, poor: 0.25 },       // score
  FCP: { good: 1800, poor: 3000 },      // ms
  TTFB: { good: 800, poor: 1800 },      // ms
};

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

function getRating(name: MetricName, value: number): MetricRating {
  const threshold = THRESHOLDS[name];
  if (value <= threshold.good) return 'good';
  if (value <= threshold.poor) return 'needs-improvement';
  return 'poor';
}

function generateId(): string {
  return `v${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function detectDeviceType(): string {
  const ua = navigator.userAgent.toLowerCase();
  if (/android tv|webos|tizen|smart-tv/i.test(ua)) return 'tv';
  if (/mobile|android|iphone/i.test(ua)) return 'mobile';
  if (/tablet|ipad/i.test(ua)) return 'tablet';
  return 'desktop';
}

function getConnectionType(): string {
  const connection = (navigator as any).connection;
  return connection?.effectiveType || 'unknown';
}

// =============================================================================
// WEB VITALS SERVICE CLASS
// =============================================================================

class WebVitalsService {
  private metrics: Map<MetricName, WebVitalMetric> = new Map();
  private observers: PerformanceObserver[] = [];
  private isInitialized: boolean = false;
  private reportQueue: WebVitalsReport[] = [];
  private reportCallback?: (report: WebVitalsReport) => void;

  /**
   * Initialize web vitals monitoring
   */
  init(onReport?: (report: WebVitalsReport) => void): void {
    if (this.isInitialized) return;
    this.isInitialized = true;
    this.reportCallback = onReport;

    // Check browser support
    if (typeof PerformanceObserver === 'undefined') {
      console.warn('[WebVitals] PerformanceObserver not supported');
      return;
    }

    this.observeLCP();
    this.observeFID();
    this.observeCLS();
    this.observeFCP();
    this.observeTTFB();

    // Report on page hide
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') {
        this.sendReport();
      }
    });

    // Report before unload
    window.addEventListener('beforeunload', () => {
      this.sendReport();
    });

    console.log('[WebVitals] Monitoring initialized');
  }

  /**
   * Observe LCP (Largest Contentful Paint)
   */
  private observeLCP(): void {
    try {
      const observer = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        const lastEntry = entries[entries.length - 1] as any;
        
        if (lastEntry) {
          this.recordMetric('LCP', lastEntry.startTime);
        }
      });

      observer.observe({ type: 'largest-contentful-paint', buffered: true });
      this.observers.push(observer);
    } catch (e) {
      console.debug('[WebVitals] LCP observer not supported');
    }
  }

  /**
   * Observe FID (First Input Delay)
   */
  private observeFID(): void {
    try {
      const observer = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        const firstEntry = entries[0] as any;
        
        if (firstEntry) {
          this.recordMetric('FID', firstEntry.processingStart - firstEntry.startTime);
        }
      });

      observer.observe({ type: 'first-input', buffered: true });
      this.observers.push(observer);
    } catch (e) {
      console.debug('[WebVitals] FID observer not supported');
    }
  }

  /**
   * Observe CLS (Cumulative Layout Shift)
   */
  private observeCLS(): void {
    let clsValue = 0;
    let sessionValue = 0;
    let sessionEntries: any[] = [];

    try {
      const observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries() as any[]) {
          if (!entry.hadRecentInput) {
            const firstSessionEntry = sessionEntries[0];
            const lastSessionEntry = sessionEntries[sessionEntries.length - 1];

            if (
              sessionValue &&
              entry.startTime - lastSessionEntry?.startTime < 1000 &&
              entry.startTime - firstSessionEntry?.startTime < 5000
            ) {
              sessionValue += entry.value;
              sessionEntries.push(entry);
            } else {
              sessionValue = entry.value;
              sessionEntries = [entry];
            }

            if (sessionValue > clsValue) {
              clsValue = sessionValue;
              this.recordMetric('CLS', clsValue);
            }
          }
        }
      });

      observer.observe({ type: 'layout-shift', buffered: true });
      this.observers.push(observer);
    } catch (e) {
      console.debug('[WebVitals] CLS observer not supported');
    }
  }

  /**
   * Observe FCP (First Contentful Paint)
   */
  private observeFCP(): void {
    try {
      const observer = new PerformanceObserver((list) => {
        const entries = list.getEntriesByName('first-contentful-paint');
        if (entries.length > 0) {
          this.recordMetric('FCP', entries[0].startTime);
        }
      });

      observer.observe({ type: 'paint', buffered: true });
      this.observers.push(observer);
    } catch (e) {
      console.debug('[WebVitals] FCP observer not supported');
    }
  }

  /**
   * Observe TTFB (Time to First Byte)
   */
  private observeTTFB(): void {
    try {
      const observer = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        const navEntry = entries[0] as PerformanceNavigationTiming;
        
        if (navEntry) {
          const ttfb = navEntry.responseStart - navEntry.requestStart;
          this.recordMetric('TTFB', ttfb);
        }
      });

      observer.observe({ type: 'navigation', buffered: true });
      this.observers.push(observer);
    } catch (e) {
      // Fallback to performance.timing
      if (performance.timing) {
        const ttfb = performance.timing.responseStart - performance.timing.requestStart;
        if (ttfb > 0) {
          this.recordMetric('TTFB', ttfb);
        }
      }
    }
  }

  /**
   * Record a metric
   */
  private recordMetric(name: MetricName, value: number): void {
    const existing = this.metrics.get(name);
    const delta = existing ? value - existing.value : value;

    const metric: WebVitalMetric = {
      name,
      value,
      rating: getRating(name, value),
      delta,
      id: generateId(),
      navigationType: this.getNavigationType(),
      timestamp: Date.now(),
    };

    this.metrics.set(name, metric);
    console.log(`[WebVitals] ${name}:`, value.toFixed(name === 'CLS' ? 4 : 0), `(${metric.rating})`);
  }

  /**
   * Get navigation type
   */
  private getNavigationType(): string {
    const nav = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
    return nav?.type || 'unknown';
  }

  /**
   * Calculate overall performance score (0-100)
   */
  calculateScore(): number {
    const weights: Record<MetricName, number> = {
      LCP: 25,
      FID: 25,
      INP: 0,
      CLS: 25,
      FCP: 15,
      TTFB: 10,
    };

    let totalWeight = 0;
    let weightedScore = 0;

    this.metrics.forEach((metric, name) => {
      const weight = weights[name] || 0;
      if (weight === 0) return;

      let score: number;
      switch (metric.rating) {
        case 'good': score = 100; break;
        case 'needs-improvement': score = 50; break;
        case 'poor': score = 0; break;
      }

      weightedScore += score * weight;
      totalWeight += weight;
    });

    return totalWeight > 0 ? Math.round(weightedScore / totalWeight) : 0;
  }

  /**
   * Get current metrics
   */
  getMetrics(): Partial<Record<MetricName, WebVitalMetric>> {
    const result: Partial<Record<MetricName, WebVitalMetric>> = {};
    this.metrics.forEach((metric, name) => {
      result[name] = metric;
    });
    return result;
  }

  /**
   * Get report for current page
   */
  getReport(): WebVitalsReport {
    return {
      url: window.location.href,
      timestamp: Date.now(),
      metrics: this.getMetrics(),
      deviceType: detectDeviceType(),
      connectionType: getConnectionType(),
      score: this.calculateScore(),
    };
  }

  /**
   * Send report
   */
  sendReport(): void {
    const report = this.getReport();
    
    if (Object.keys(report.metrics).length === 0) {
      return;
    }

    // Call callback if provided
    if (this.reportCallback) {
      this.reportCallback(report);
    }

    // Queue for later if needed
    this.reportQueue.push(report);

    // Log summary
    console.log('[WebVitals] Report:', {
      score: report.score,
      metrics: Object.entries(report.metrics).map(([name, m]) => 
        `${name}: ${m?.value.toFixed(name === 'CLS' ? 4 : 0)} (${m?.rating})`
      ).join(', '),
    });
  }

  /**
   * Get queued reports
   */
  getQueuedReports(): WebVitalsReport[] {
    return [...this.reportQueue];
  }

  /**
   * Clear queued reports
   */
  clearQueue(): void {
    this.reportQueue = [];
  }

  /**
   * Get rating color for UI
   */
  getRatingColor(rating: MetricRating): string {
    switch (rating) {
      case 'good': return 'text-green-500';
      case 'needs-improvement': return 'text-yellow-500';
      case 'poor': return 'text-red-500';
    }
  }

  /**
   * Get score color for UI
   */
  getScoreColor(score: number): string {
    if (score >= 90) return 'text-green-500';
    if (score >= 50) return 'text-yellow-500';
    return 'text-red-500';
  }

  /**
   * Format metric value for display
   */
  formatMetricValue(name: MetricName, value: number): string {
    if (name === 'CLS') {
      return value.toFixed(3);
    }
    if (value >= 1000) {
      return `${(value / 1000).toFixed(1)}s`;
    }
    return `${Math.round(value)}ms`;
  }

  /**
   * Destroy observers
   */
  destroy(): void {
    this.observers.forEach(observer => observer.disconnect());
    this.observers = [];
    this.metrics.clear();
    this.isInitialized = false;
    console.log('[WebVitals] Destroyed');
  }
}

// =============================================================================
// SINGLETON EXPORT
// =============================================================================

export const webVitalsService = new WebVitalsService();
export default webVitalsService;
