/**
 * Smart Prefetch Service
 * Coordinates metadata extraction, on-demand stream resolution, and ML predictions
 */

export * from './types';
export * from './metadataExtractor';
export * from './streamResolver';
export * from './mlPredictionEngine';

import { getIndexStats } from './metadataExtractor';
import { getResolutionStats } from './streamResolver';
import { mlPredictionEngine } from './mlPredictionEngine';
import type { PrefetchStats } from './types';

let stats = {
  metadataLoaded: 0,
  streamsResolved: 0,
  cacheHits: 0,
  cacheMisses: 0,
};

export function updatePrefetchStats(update: Partial<typeof stats>) {
  stats = { ...stats, ...update };
}

export function getPrefetchStats(): PrefetchStats {
  const indexStats = getIndexStats();
  const resolutionStats = getResolutionStats();
  const mlStats = mlPredictionEngine.getStats();
  
  return {
    metadataLoaded: indexStats.indexedUrls,
    streamsResolved: resolutionStats.resolutionCount,
    cacheHits: stats.cacheHits,
    cacheMisses: stats.cacheMisses,
    avgResolutionTimeMs: resolutionStats.avgResolutionTimeMs,
    mlPatternsLearned: mlStats.totalPatterns,
    mlSequencesTracked: mlStats.totalSequences,
  };
}
