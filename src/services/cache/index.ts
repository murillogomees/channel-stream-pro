/**
 * Cache Services Index
 * 
 * Centralized exports for intelligent caching system.
 */

export { behaviorTrackingService } from './behaviorTrackingService';
export type { ViewingSession, ViewingPattern, UserBehaviorProfile } from './behaviorTrackingService';

export { predictiveCacheEngine } from './predictiveCacheEngine';
export type { PredictionScore, PredictionReason, PredictionContext } from './predictiveCacheEngine';

export { cacheWarmingService } from './cacheWarmingService';
export type { WarmingStats, WarmingConfig } from './cacheWarmingService';

// Re-export stream cache service
export { streamCacheService } from '../streamCacheService';
export type { CacheStats, CacheConfig, CachedItem } from '../streamCacheService';
