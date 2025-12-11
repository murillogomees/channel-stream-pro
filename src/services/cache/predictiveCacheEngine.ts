/**
 * ============================================================================
 * Predictive Cache Engine - Simplified
 * ============================================================================
 * 
 * Prediction engine for content caching.
 * Simplified to not depend on non-existent database tables.
 */

import { behaviorTrackingService } from './behaviorTrackingService';

// =============================================================================
// TYPES
// =============================================================================

export interface PredictionScore {
  channelId: string;
  score: number;
  confidence: number;
  reasons: PredictionReason[];
}

export type PredictionReason = 
  | 'behavior_pattern'
  | 'time_correlation'
  | 'sequence_prediction'
  | 'category_affinity'
  | 'trending_content'
  | 'adjacent_position'
  | 'continue_watching';

export interface PredictionContext {
  currentChannelId?: string;
  currentCategoryId?: string;
  channelList: Array<{ id: string; stream_url: string; name: string; category_id?: string }>;
  profileId?: string;
  sessionStartTime?: number;
}

interface PredictionConfig {
  weights: {
    behaviorPattern: number;
    timeCorrelation: number;
    sequencePrediction: number;
    categoryAffinity: number;
    trending: number;
    adjacent: number;
    continueWatching: number;
  };
  minConfidence: number;
  maxPredictions: number;
  decayFactor: number;
}

// =============================================================================
// DEFAULT CONFIG
// =============================================================================

const DEFAULT_CONFIG: PredictionConfig = {
  weights: {
    behaviorPattern: 0.25,
    timeCorrelation: 0.15,
    sequencePrediction: 0.20,
    categoryAffinity: 0.10,
    trending: 0.10,
    adjacent: 0.15,
    continueWatching: 0.05,
  },
  minConfidence: 0.3,
  maxPredictions: 8,
  decayFactor: 0.9,
};

// =============================================================================
// PREDICTIVE CACHE ENGINE
// =============================================================================

class PredictiveCacheEngine {
  private config: PredictionConfig = DEFAULT_CONFIG;
  private predictionCache: Map<string, PredictionScore[]> = new Map();
  private cacheExpiry: number = 30000; // 30 seconds
  private lastPredictionTime: number = 0;

  /**
   * Get predictions for what to cache next
   */
  async getPredictions(context: PredictionContext): Promise<PredictionScore[]> {
    const cacheKey = `${context.currentChannelId}_${context.profileId}`;
    const now = Date.now();

    // Check cache
    if (
      this.predictionCache.has(cacheKey) && 
      now - this.lastPredictionTime < this.cacheExpiry
    ) {
      return this.predictionCache.get(cacheKey)!;
    }

    const scores: Map<string, PredictionScore> = new Map();

    // 1. Behavior-based predictions
    if (context.profileId && context.currentChannelId) {
      const behaviorPredictions = behaviorTrackingService.getPredictedChannels(
        context.currentChannelId,
        10
      );
      
      behaviorPredictions.forEach((channelId, index) => {
        const score = this.getOrCreateScore(scores, channelId);
        const weight = this.config.weights.behaviorPattern * Math.pow(this.config.decayFactor, index);
        score.score += weight * 100;
        score.confidence += 0.2;
        score.reasons.push('behavior_pattern');
      });
    }

    // 2. Time-based predictions
    if (context.profileId) {
      const timePredictions = behaviorTrackingService.getTimeBasedPredictions(5);
      
      timePredictions.forEach((channelId, index) => {
        const score = this.getOrCreateScore(scores, channelId);
        const weight = this.config.weights.timeCorrelation * Math.pow(this.config.decayFactor, index);
        score.score += weight * 100;
        score.confidence += 0.15;
        score.reasons.push('time_correlation');
      });
    }

    // 3. Adjacent channel predictions
    if (context.currentChannelId && context.channelList.length > 0) {
      const currentIndex = context.channelList.findIndex(
        c => c.id === context.currentChannelId
      );
      
      if (currentIndex !== -1) {
        // Immediate neighbors (high priority)
        [-1, 1].forEach(offset => {
          const idx = currentIndex + offset;
          if (idx >= 0 && idx < context.channelList.length) {
            const channel = context.channelList[idx];
            const score = this.getOrCreateScore(scores, channel.id);
            score.score += this.config.weights.adjacent * 100;
            score.confidence += 0.25;
            score.reasons.push('adjacent_position');
          }
        });

        // Extended neighbors (medium priority)
        [-2, 2].forEach(offset => {
          const idx = currentIndex + offset;
          if (idx >= 0 && idx < context.channelList.length) {
            const channel = context.channelList[idx];
            const score = this.getOrCreateScore(scores, channel.id);
            score.score += this.config.weights.adjacent * 50;
            score.confidence += 0.1;
            score.reasons.push('adjacent_position');
          }
        });
      }
    }

    // 4. Category affinity predictions
    if (context.currentCategoryId && context.profileId) {
      const preferredCategories = behaviorTrackingService.getPreferredCategories();
      
      if (preferredCategories.includes(context.currentCategoryId)) {
        // Boost all channels in current category
        context.channelList
          .filter(c => c.category_id === context.currentCategoryId)
          .slice(0, 5)
          .forEach(channel => {
            const score = this.getOrCreateScore(scores, channel.id);
            score.score += this.config.weights.categoryAffinity * 60;
            score.confidence += 0.1;
            score.reasons.push('category_affinity');
          });
      }
    }

    // Normalize and filter
    const predictions = Array.from(scores.values())
      .filter(s => s.channelId !== context.currentChannelId)
      .map(s => ({
        ...s,
        score: Math.min(s.score, 100),
        confidence: Math.min(s.confidence, 1),
      }))
      .filter(s => s.confidence >= this.config.minConfidence)
      .sort((a, b) => b.score - a.score)
      .slice(0, this.config.maxPredictions);

    // Cache results
    this.predictionCache.set(cacheKey, predictions);
    this.lastPredictionTime = now;

    console.log('[PredictiveEngine] Generated', predictions.length, 'predictions');
    return predictions;
  }

  /**
   * Get channels to preload with priority
   */
  async getPreloadPriority(context: PredictionContext): Promise<{
    high: string[];
    medium: string[];
    low: string[];
  }> {
    const predictions = await this.getPredictions(context);
    
    return {
      high: predictions
        .filter(p => p.score >= 70)
        .map(p => p.channelId),
      medium: predictions
        .filter(p => p.score >= 40 && p.score < 70)
        .map(p => p.channelId),
      low: predictions
        .filter(p => p.score < 40)
        .map(p => p.channelId),
    };
  }

  /**
   * Get URL for a channel ID
   */
  getChannelUrl(
    channelId: string, 
    channelList: Array<{ id: string; stream_url: string }>
  ): string | undefined {
    return channelList.find(c => c.id === channelId)?.stream_url;
  }

  /**
   * Update config (for A/B testing)
   */
  updateConfig(newConfig: Partial<PredictionConfig>): void {
    this.config = { ...this.config, ...newConfig };
    this.clearCache();
  }

  /**
   * Clear prediction cache
   */
  clearCache(): void {
    this.predictionCache.clear();
    this.lastPredictionTime = 0;
  }

  /**
   * Get prediction stats for debugging
   */
  getStats(): {
    cacheSize: number;
    lastPredictionAge: number;
    config: PredictionConfig;
  } {
    return {
      cacheSize: this.predictionCache.size,
      lastPredictionAge: Date.now() - this.lastPredictionTime,
      config: this.config,
    };
  }

  // ===========================================================================
  // PRIVATE METHODS
  // ===========================================================================

  private getOrCreateScore(
    scores: Map<string, PredictionScore>,
    channelId: string
  ): PredictionScore {
    if (!scores.has(channelId)) {
      scores.set(channelId, {
        channelId,
        score: 0,
        confidence: 0,
        reasons: [],
      });
    }
    return scores.get(channelId)!;
  }
}

// =============================================================================
// SINGLETON EXPORT
// =============================================================================

export const predictiveCacheEngine = new PredictiveCacheEngine();
export default predictiveCacheEngine;
