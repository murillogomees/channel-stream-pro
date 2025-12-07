/**
 * Hooks Export
 */

// Streaming & Preloading
export { useIntelligentPreload } from './useIntelligentPreload';
export { useChannelPreloader } from './useChannelPreloader';
export { useStreamAnalytics } from './useStreamAnalytics';
export { useSegmentPrefetch } from './useSegmentPrefetch';

// ABR (Adaptive Bitrate)
export { useABR } from './useABR';

// Player Analytics & Resume
export { usePlayerAnalytics } from './usePlayerAnalytics';
export { useResume } from './useResume';

// Performance hooks (V2 is canonical)
export { usePlayerPerformanceV2 } from './usePlayerPerformanceV2';
export { useFastStartupV2 } from './useFastStartupV2';

// Enhanced Player (unified hook)
export { useEnhancedPlayer } from './useEnhancedPlayer';

// Feature Flags
export { 
  useFeatureFlags, 
  useEnhancedABR, 
  useSegmentPrefetch as useSegmentPrefetchFlag,
  useResumeSupport,
  usePlayerAnalytics as usePlayerAnalyticsFlag,
  useWebVitalsTracking,
  useTVOptimizations,
} from './useFeatureFlags';

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
export { useNetflixLazyLoad } from './useNetflixLazyLoad';

// Smart Cache
export { useSmartCache } from './useSmartCache';
export type { SmartCacheStats, UseSmartCacheOptions } from './useSmartCache';

// Viewer Profiles & Content
export { useViewerProfiles } from './useViewerProfiles';
export type { ViewerProfile, CreateProfileInput, UpdateProfileInput } from './useViewerProfiles';
export { useWatchHistory } from './useWatchHistory';
export type { WatchHistoryItem } from './useWatchHistory';
export { useFavorites } from './useFavorites';
export type { FavoriteItem } from './useFavorites';

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
export type { FeatureFlag } from '@/services/featureFlagsService';

// Quality Levels
export { useQualityLevels } from './useQualityLevels';
