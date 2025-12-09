/**
 * Hooks Export - Cleaned after M3U/Streaming removal
 */

// Feature Flags
export { 
  useFeatureFlags, 
  useEnhancedABR, 
  useResumeSupport,
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

// Favorites
export { useFavorites } from './useFavorites';
export type { FavoriteItem } from './useFavorites';

// Re-export types
export type { ConnectionInfo, ConnectionQuality } from '@/services/connectionService';
export type { RecoveryStats, RecoveryConfig } from '@/services/errorRecoveryService';
export type { WebVitalMetric, WebVitalsReport, MetricName } from '@/services/webVitalsService';
export type { FeatureFlag } from '@/services/featureFlagsService';

// Quality Levels
export { useQualityLevels } from './useQualityLevels';
