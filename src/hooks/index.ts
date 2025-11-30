/**
 * Hooks Export
 */

// Streaming & Preloading
export { usePreloadStreams } from './usePreloadStreams';
export { useIntelligentPreload } from './useIntelligentPreload';
export { useChannelPreloader } from './useChannelPreloader';
export { useStreamAnalytics } from './useStreamAnalytics';

// ABR (Adaptive Bitrate)
export { useABR } from './useABR';

// Connection & Network
export { useConnectionAware } from './useConnectionAware';

// Error Recovery
export { useErrorRecovery } from './useErrorRecovery';

// Web Vitals
export { useWebVitals } from './useWebVitals';

// Memory Management
export { usePlayerCleanup, cleanupDetachedPlayers } from './usePlayerCleanup';

// Search & Performance
export { useDebouncedSearch, useDebouncedValue } from './useDebouncedSearch';
export { useLazyLoadContent } from './useLazyLoadContent';

// Cloudflare Stream Signed URLs
export { useSignedStreamUrl, clearSignedUrlCache, preloadSignedUrl } from './useSignedStreamUrl';

// Cloudflare Stream Analytics
export { useCFStreamAnalytics, TIME_RANGES } from './useCFStreamAnalytics';
export type { ChannelMetrics, AggregatedMetrics, MetricsTimeRange } from './useCFStreamAnalytics';

// Re-export types
export type { PreloadCandidate, PreloadReason } from '@/services/intelligentPreloadService';
export type { QualityLevel, ABRStats, ABRMode, ABRConfig } from '@/services/abrService';
export type { ConnectionInfo, ConnectionQuality } from '@/services/connectionService';
export type { RecoveryStats, RecoveryConfig } from '@/services/errorRecoveryService';
export type { WebVitalMetric, WebVitalsReport, MetricName } from '@/services/webVitalsService';
