/**
 * ML-based Prediction Engine
 * Uses behavioral patterns and statistical analysis for intelligent content preloading
 */

interface ViewingPattern {
  channelId: string;
  viewCount: number;
  avgDuration: number;
  lastViewed: number;
  timeOfDay: number[];
  dayOfWeek: number[];
}

interface PredictionResult {
  channelId: string;
  score: number;
  confidence: number;
  reason: 'time_pattern' | 'frequency' | 'sequence' | 'similar_content' | 'popular';
}

interface UserBehavior {
  patterns: Map<string, ViewingPattern>;
  sequences: string[][];
  lastChannels: string[];
  sessionStart: number;
}

const STORAGE_KEY = 'iptv_ml_behavior';
const MAX_SEQUENCES = 50;
const MAX_LAST_CHANNELS = 20;
const PREDICTION_WEIGHTS = {
  timePattern: 0.3,
  frequency: 0.25,
  sequence: 0.25,
  similarContent: 0.1,
  popular: 0.1,
};

class MLPredictionEngine {
  private behavior: UserBehavior;
  private initialized = false;

  constructor() {
    this.behavior = this.getDefaultBehavior();
  }

  private getDefaultBehavior(): UserBehavior {
    return {
      patterns: new Map(),
      sequences: [],
      lastChannels: [],
      sessionStart: Date.now(),
    };
  }

  initialize(): void {
    if (this.initialized) return;

    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        this.behavior = {
          patterns: new Map(Object.entries(parsed.patterns || {})),
          sequences: parsed.sequences || [],
          lastChannels: parsed.lastChannels || [],
          sessionStart: Date.now(),
        };
      }
    } catch (e) {
      console.warn('[MLPrediction] Failed to load behavior data:', e);
    }

    this.initialized = true;
  }

  /**
   * Record a channel view event
   */
  recordView(channelId: string, duration: number = 0): void {
    this.initialize();

    const now = Date.now();
    const hour = new Date().getHours();
    const day = new Date().getDay();

    // Update pattern
    const existing = this.behavior.patterns.get(channelId);
    if (existing) {
      existing.viewCount++;
      existing.avgDuration = (existing.avgDuration * (existing.viewCount - 1) + duration) / existing.viewCount;
      existing.lastViewed = now;
      if (!existing.timeOfDay.includes(hour)) existing.timeOfDay.push(hour);
      if (!existing.dayOfWeek.includes(day)) existing.dayOfWeek.push(day);
    } else {
      this.behavior.patterns.set(channelId, {
        channelId,
        viewCount: 1,
        avgDuration: duration,
        lastViewed: now,
        timeOfDay: [hour],
        dayOfWeek: [day],
      });
    }

    // Update sequences
    if (this.behavior.lastChannels.length > 0) {
      const lastChannel = this.behavior.lastChannels[this.behavior.lastChannels.length - 1];
      if (lastChannel !== channelId) {
        this.behavior.sequences.push([lastChannel, channelId]);
        if (this.behavior.sequences.length > MAX_SEQUENCES) {
          this.behavior.sequences.shift();
        }
      }
    }

    // Update last channels
    this.behavior.lastChannels.push(channelId);
    if (this.behavior.lastChannels.length > MAX_LAST_CHANNELS) {
      this.behavior.lastChannels.shift();
    }

    this.persist();
  }

  /**
   * Get predictions for what the user might watch next
   */
  getPredictions(currentChannelId: string | null, allChannelIds: string[], limit: number = 5): PredictionResult[] {
    this.initialize();

    const now = Date.now();
    const hour = new Date().getHours();
    const day = new Date().getDay();
    const scores: Map<string, { score: number; reasons: Map<string, number> }> = new Map();

    // Initialize scores for all channels
    allChannelIds.forEach(id => {
      if (id !== currentChannelId) {
        scores.set(id, { score: 0, reasons: new Map() });
      }
    });

    // 1. Time pattern scoring
    this.behavior.patterns.forEach((pattern, channelId) => {
      if (channelId === currentChannelId) return;
      
      const scoreData = scores.get(channelId);
      if (!scoreData) return;

      const timeMatch = pattern.timeOfDay.includes(hour) ? 1 : 0;
      const dayMatch = pattern.dayOfWeek.includes(day) ? 1 : 0;
      const timeScore = (timeMatch + dayMatch) / 2;
      
      scoreData.reasons.set('time_pattern', timeScore * PREDICTION_WEIGHTS.timePattern);
      scoreData.score += timeScore * PREDICTION_WEIGHTS.timePattern;
    });

    // 2. Frequency scoring (normalized by total views)
    const totalViews = Array.from(this.behavior.patterns.values()).reduce((sum, p) => sum + p.viewCount, 0);
    this.behavior.patterns.forEach((pattern, channelId) => {
      if (channelId === currentChannelId) return;
      
      const scoreData = scores.get(channelId);
      if (!scoreData) return;

      const freqScore = totalViews > 0 ? pattern.viewCount / totalViews : 0;
      scoreData.reasons.set('frequency', freqScore * PREDICTION_WEIGHTS.frequency);
      scoreData.score += freqScore * PREDICTION_WEIGHTS.frequency;
    });

    // 3. Sequence scoring (what channels follow the current one)
    if (currentChannelId) {
      const followCounts: Map<string, number> = new Map();
      this.behavior.sequences.forEach(([from, to]) => {
        if (from === currentChannelId) {
          followCounts.set(to, (followCounts.get(to) || 0) + 1);
        }
      });

      const maxFollows = Math.max(...Array.from(followCounts.values()), 1);
      followCounts.forEach((count, channelId) => {
        const scoreData = scores.get(channelId);
        if (!scoreData) return;

        const seqScore = count / maxFollows;
        scoreData.reasons.set('sequence', seqScore * PREDICTION_WEIGHTS.sequence);
        scoreData.score += seqScore * PREDICTION_WEIGHTS.sequence;
      });
    }

    // 4. Recency boost (recently viewed channels get a small boost)
    this.behavior.patterns.forEach((pattern, channelId) => {
      if (channelId === currentChannelId) return;
      
      const scoreData = scores.get(channelId);
      if (!scoreData) return;

      const hoursSinceView = (now - pattern.lastViewed) / (1000 * 60 * 60);
      const recencyScore = Math.max(0, 1 - hoursSinceView / 168); // Decay over 1 week
      scoreData.score += recencyScore * 0.05; // Small boost
    });

    // Convert to array and sort
    const results: PredictionResult[] = Array.from(scores.entries())
      .map(([channelId, data]) => {
        const topReason = Array.from(data.reasons.entries())
          .sort((a, b) => b[1] - a[1])[0];
        
        return {
          channelId,
          score: Math.min(1, data.score),
          confidence: this.calculateConfidence(channelId),
          reason: (topReason?.[0] || 'popular') as PredictionResult['reason'],
        };
      })
      .filter(r => r.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);

    return results;
  }

  /**
   * Calculate confidence based on data quality
   */
  private calculateConfidence(channelId: string): number {
    const pattern = this.behavior.patterns.get(channelId);
    if (!pattern) return 0.1;

    const viewFactor = Math.min(1, pattern.viewCount / 10);
    const timeFactor = Math.min(1, pattern.timeOfDay.length / 5);
    const dayFactor = Math.min(1, pattern.dayOfWeek.length / 3);

    return (viewFactor + timeFactor + dayFactor) / 3;
  }

  /**
   * Get preload priorities based on predictions
   */
  getPreloadPriorities(
    currentChannelId: string | null,
    allChannelIds: string[]
  ): { high: string[]; medium: string[]; low: string[] } {
    const predictions = this.getPredictions(currentChannelId, allChannelIds, 10);

    return {
      high: predictions.filter(p => p.score > 0.6).map(p => p.channelId),
      medium: predictions.filter(p => p.score > 0.3 && p.score <= 0.6).map(p => p.channelId),
      low: predictions.filter(p => p.score <= 0.3).map(p => p.channelId),
    };
  }

  /**
   * Get statistics about learned behavior
   */
  getStats(): {
    totalPatterns: number;
    totalSequences: number;
    topChannels: { id: string; views: number }[];
  } {
    this.initialize();

    const topChannels = Array.from(this.behavior.patterns.entries())
      .sort((a, b) => b[1].viewCount - a[1].viewCount)
      .slice(0, 5)
      .map(([id, p]) => ({ id, views: p.viewCount }));

    return {
      totalPatterns: this.behavior.patterns.size,
      totalSequences: this.behavior.sequences.length,
      topChannels,
    };
  }

  /**
   * Clear all learned data
   */
  clearData(): void {
    this.behavior = this.getDefaultBehavior();
    localStorage.removeItem(STORAGE_KEY);
  }

  private persist(): void {
    try {
      const data = {
        patterns: Object.fromEntries(this.behavior.patterns),
        sequences: this.behavior.sequences,
        lastChannels: this.behavior.lastChannels,
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (e) {
      console.warn('[MLPrediction] Failed to persist behavior data:', e);
    }
  }
}

export const mlPredictionEngine = new MLPredictionEngine();
export type { PredictionResult, ViewingPattern };
