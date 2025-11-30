/**
 * Hooks Export
 */

// Streaming & Preloading
export { usePreloadStreams } from './usePreloadStreams';
export { useIntelligentPreload } from './useIntelligentPreload';
export { useChannelPreloader } from './useChannelPreloader';
export { useStreamAnalytics } from './useStreamAnalytics';
export { useSegmentPrefetch } from './useSegmentPrefetch';

// ABR (Adaptive Bitrate)
export { useABR } from './useABR';

// Player Analytics & Resume
export { usePlayerAnalytics } from './usePlayerAnalytics';
export { useResume } from './useResume';

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

// Smart Cache
export { useSmartCache } from './useSmartCache';
export type { SmartCacheStats, UseSmartCacheOptions } from './useSmartCache';

// Re-export types
export type { PreloadCandidate, PreloadReason } from '@/services/intelligentPreloadService';
export type { QualityLevel, ABRStats, ABRMode, ABRConfig } from '@/services/abrService';
export type { ConnectionInfo, ConnectionQuality } from '@/services/connectionService';
export type { RecoveryStats, RecoveryConfig } from '@/services/errorRecoveryService';
export type { WebVitalMetric, WebVitalsReport, MetricName } from '@/services/webVitalsService';
export type { PredictionScore, PredictionReason, WarmingStats, CacheStats } from '@/services/cache';
export type { ABRTuningConfig, ABRMetrics } from '@/services/enhancedABRService';
export type { ResumeProgress } from '@/services/resumeService';
export type { PlayerEventType, PlayerEvent } from '@/services/playerEventsService';
