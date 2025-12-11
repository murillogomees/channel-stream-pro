/**
 * ============================================================================
 * Behavior Tracking Service
 * ============================================================================
 * 
 * Tracks user viewing behavior for intelligent cache predictions.
 * Collects patterns like viewing times, channel sequences, and session context.
 */

import { supabase } from '@/integrations/supabase/client';

// =============================================================================
// TYPES
// =============================================================================

export interface ViewingSession {
  sessionId: string;
  profileId: string;
  startedAt: number;
  channelSequence: string[];
  currentChannelId?: string;
  categoryHistory: string[];
}

export interface ViewingPattern {
  channelId: string;
  hourOfDay: number;
  dayOfWeek: number;
  frequency: number;
  avgWatchDuration: number;
  followedBy: Map<string, number>; // channelId -> count
}

export interface UserBehaviorProfile {
  profileId: string;
  preferredCategories: Map<string, number>;
  peakHours: number[];
  channelAffinities: Map<string, number>;
  sessionPatterns: ViewingPattern[];
  lastUpdated: number;
}

interface ChannelTransition {
  from: string;
  to: string;
  timestamp: number;
}

// =============================================================================
// CONSTANTS
// =============================================================================

const STORAGE_KEY = 'iptv_behavior_data';
const SESSION_TIMEOUT = 30 * 60 * 1000; // 30 minutes
const MAX_TRANSITIONS = 100;
const MAX_PATTERNS = 50;
const SYNC_INTERVAL = 5 * 60 * 1000; // 5 minutes

// =============================================================================
// BEHAVIOR TRACKING SERVICE
// =============================================================================

class BehaviorTrackingService {
  private currentSession: ViewingSession | null = null;
  private transitions: ChannelTransition[] = [];
  private behaviorProfile: UserBehaviorProfile | null = null;
  private syncTimer: NodeJS.Timeout | null = null;
  private isDirty = false;

  /**
   * Initialize tracking for a user profile
   */
  async initialize(profileId: string): Promise<void> {
    // Load cached behavior data
    this.loadFromStorage(profileId);
    
    // Start new session
    this.startSession(profileId);
    
    // Setup periodic sync
    this.setupSyncTimer();
    
    console.log('[BehaviorTracking] Initialized for profile:', profileId);
  }

  /**
   * Track channel view event
   */
  trackChannelView(channelId: string, categoryId?: string): void {
    if (!this.currentSession) return;

    const now = Date.now();
    
    // Record transition if we have a previous channel
    if (this.currentSession.currentChannelId && 
        this.currentSession.currentChannelId !== channelId) {
      this.transitions.push({
        from: this.currentSession.currentChannelId,
        to: channelId,
        timestamp: now,
      });
      
      // Trim old transitions
      if (this.transitions.length > MAX_TRANSITIONS) {
        this.transitions = this.transitions.slice(-MAX_TRANSITIONS);
      }
    }

    // Update session
    this.currentSession.currentChannelId = channelId;
    
    if (!this.currentSession.channelSequence.includes(channelId)) {
      this.currentSession.channelSequence.push(channelId);
    }
    
    if (categoryId && !this.currentSession.categoryHistory.includes(categoryId)) {
      this.currentSession.categoryHistory.push(categoryId);
    }

    // Update behavior profile
    this.updateBehaviorProfile(channelId, categoryId);
    
    this.isDirty = true;
  }

  /**
   * Track watch duration
   */
  trackWatchDuration(channelId: string, durationSeconds: number): void {
    if (!this.behaviorProfile) return;

    const pattern = this.behaviorProfile.sessionPatterns.find(
      p => p.channelId === channelId
    );

    if (pattern) {
      // Update average watch duration
      const totalWatched = pattern.avgWatchDuration * pattern.frequency;
      pattern.avgWatchDuration = (totalWatched + durationSeconds) / (pattern.frequency + 1);
    }

    this.isDirty = true;
  }

  /**
   * Get predicted next channels based on behavior
   */
  getPredictedChannels(currentChannelId: string, limit: number = 5): string[] {
    if (!this.behaviorProfile) return [];

    const predictions: Map<string, number> = new Map();
    
    // 1. Check transition patterns (highest weight)
    const pattern = this.behaviorProfile.sessionPatterns.find(
      p => p.channelId === currentChannelId
    );
    
    if (pattern?.followedBy) {
      pattern.followedBy.forEach((count, channelId) => {
        const current = predictions.get(channelId) || 0;
        predictions.set(channelId, current + count * 3);
      });
    }

    // 2. Check current session sequence
    if (this.currentSession) {
      const sequence = this.currentSession.channelSequence;
      const currentIndex = sequence.indexOf(currentChannelId);
      
      if (currentIndex > 0) {
        // User might go back
        const prev = sequence[currentIndex - 1];
        const current = predictions.get(prev) || 0;
        predictions.set(prev, current + 2);
      }
    }

    // 3. Time-based patterns
    const currentHour = new Date().getHours();
    const currentDay = new Date().getDay();
    
    this.behaviorProfile.sessionPatterns
      .filter(p => p.hourOfDay === currentHour || p.dayOfWeek === currentDay)
      .forEach(p => {
        const current = predictions.get(p.channelId) || 0;
        predictions.set(p.channelId, current + p.frequency);
      });

    // 4. Category affinity
    if (this.currentSession?.categoryHistory.length) {
      const recentCategory = this.currentSession.categoryHistory[
        this.currentSession.categoryHistory.length - 1
      ];
      
      this.behaviorProfile.sessionPatterns
        .filter(p => {
          // This would need category info - simplified here
          return this.behaviorProfile?.preferredCategories.has(recentCategory);
        })
        .forEach(p => {
          const current = predictions.get(p.channelId) || 0;
          predictions.set(p.channelId, current + 1);
        });
    }

    // Sort and return top predictions (excluding current)
    return Array.from(predictions.entries())
      .filter(([id]) => id !== currentChannelId)
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([id]) => id);
  }

  /**
   * Get channels to preload based on time and behavior
   */
  getTimeBasedPredictions(limit: number = 3): string[] {
    if (!this.behaviorProfile) return [];

    const currentHour = new Date().getHours();
    const currentDay = new Date().getDay();

    return this.behaviorProfile.sessionPatterns
      .filter(p => 
        Math.abs(p.hourOfDay - currentHour) <= 1 || 
        p.dayOfWeek === currentDay
      )
      .sort((a, b) => b.frequency - a.frequency)
      .slice(0, limit)
      .map(p => p.channelId);
  }

  /**
   * Get user's peak viewing hours
   */
  getPeakHours(): number[] {
    return this.behaviorProfile?.peakHours || [];
  }

  /**
   * Get preferred categories
   */
  getPreferredCategories(): string[] {
    if (!this.behaviorProfile) return [];
    
    return Array.from(this.behaviorProfile.preferredCategories.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([cat]) => cat);
  }

  /**
   * Get behavior stats for debugging
   */
  getStats(): {
    sessionDuration: number;
    channelsViewed: number;
    transitionsRecorded: number;
    patternsLearned: number;
  } {
    return {
      sessionDuration: this.currentSession 
        ? Date.now() - this.currentSession.startedAt 
        : 0,
      channelsViewed: this.currentSession?.channelSequence.length || 0,
      transitionsRecorded: this.transitions.length,
      patternsLearned: this.behaviorProfile?.sessionPatterns.length || 0,
    };
  }

  /**
   * Cleanup and persist data
   */
  async cleanup(): Promise<void> {
    if (this.syncTimer) {
      clearInterval(this.syncTimer);
    }
    
    await this.syncToStorage();
    this.currentSession = null;
    
    console.log('[BehaviorTracking] Cleaned up');
  }

  // ===========================================================================
  // PRIVATE METHODS
  // ===========================================================================

  private startSession(profileId: string): void {
    this.currentSession = {
      sessionId: crypto.randomUUID(),
      profileId,
      startedAt: Date.now(),
      channelSequence: [],
      categoryHistory: [],
    };
  }

  private updateBehaviorProfile(channelId: string, categoryId?: string): void {
    if (!this.behaviorProfile) {
      this.behaviorProfile = {
        profileId: this.currentSession!.profileId,
        preferredCategories: new Map(),
        peakHours: [],
        channelAffinities: new Map(),
        sessionPatterns: [],
        lastUpdated: Date.now(),
      };
    }

    const hour = new Date().getHours();
    const day = new Date().getDay();

    // Update or create pattern
    let pattern = this.behaviorProfile.sessionPatterns.find(
      p => p.channelId === channelId
    );

    if (!pattern) {
      pattern = {
        channelId,
        hourOfDay: hour,
        dayOfWeek: day,
        frequency: 0,
        avgWatchDuration: 0,
        followedBy: new Map(),
      };
      this.behaviorProfile.sessionPatterns.push(pattern);
      
      // Trim old patterns
      if (this.behaviorProfile.sessionPatterns.length > MAX_PATTERNS) {
        this.behaviorProfile.sessionPatterns = 
          this.behaviorProfile.sessionPatterns.slice(-MAX_PATTERNS);
      }
    }

    pattern.frequency++;
    pattern.hourOfDay = hour; // Update to latest hour

    // Update transition data
    if (this.currentSession?.currentChannelId) {
      const fromPattern = this.behaviorProfile.sessionPatterns.find(
        p => p.channelId === this.currentSession!.currentChannelId
      );
      
      if (fromPattern) {
        const count = fromPattern.followedBy.get(channelId) || 0;
        fromPattern.followedBy.set(channelId, count + 1);
      }
    }

    // Update category preferences
    if (categoryId) {
      const catCount = this.behaviorProfile.preferredCategories.get(categoryId) || 0;
      this.behaviorProfile.preferredCategories.set(categoryId, catCount + 1);
    }

    // Update channel affinity
    const affinity = this.behaviorProfile.channelAffinities.get(channelId) || 0;
    this.behaviorProfile.channelAffinities.set(channelId, affinity + 1);

    // Update peak hours
    if (!this.behaviorProfile.peakHours.includes(hour)) {
      this.behaviorProfile.peakHours.push(hour);
      // Keep only top viewing hours based on frequency
      if (this.behaviorProfile.peakHours.length > 5) {
        this.behaviorProfile.peakHours.shift();
      }
    }

    this.behaviorProfile.lastUpdated = Date.now();
  }

  private setupSyncTimer(): void {
    this.syncTimer = setInterval(() => {
      if (this.isDirty) {
        this.syncToStorage();
      }
    }, SYNC_INTERVAL);
  }

  private loadFromStorage(profileId: string): void {
    try {
      const stored = localStorage.getItem(`${STORAGE_KEY}_${profileId}`);
      if (stored) {
        const data = JSON.parse(stored);
        
        // Reconstruct Maps from stored arrays
        this.behaviorProfile = {
          ...data,
          preferredCategories: new Map(data.preferredCategories || []),
          channelAffinities: new Map(data.channelAffinities || []),
          sessionPatterns: (data.sessionPatterns || []).map((p: any) => ({
            ...p,
            followedBy: new Map(p.followedBy || []),
          })),
        };
        
        console.log('[BehaviorTracking] Loaded from storage');
      }
    } catch (err) {
      console.warn('[BehaviorTracking] Failed to load from storage:', err);
    }
  }

  private async syncToStorage(): Promise<void> {
    if (!this.behaviorProfile) return;

    try {
      // Convert Maps to arrays for JSON serialization
      const toStore = {
        ...this.behaviorProfile,
        preferredCategories: Array.from(this.behaviorProfile.preferredCategories.entries()),
        channelAffinities: Array.from(this.behaviorProfile.channelAffinities.entries()),
        sessionPatterns: this.behaviorProfile.sessionPatterns.map(p => ({
          ...p,
          followedBy: Array.from(p.followedBy.entries()),
        })),
      };

      localStorage.setItem(
        `${STORAGE_KEY}_${this.behaviorProfile.profileId}`,
        JSON.stringify(toStore)
      );

      this.isDirty = false;
      console.log('[BehaviorTracking] Synced to storage');
    } catch (err) {
      console.error('[BehaviorTracking] Failed to sync to storage:', err);
    }
  }
}

// =============================================================================
// SINGLETON EXPORT
// =============================================================================

export const behaviorTrackingService = new BehaviorTrackingService();
export default behaviorTrackingService;
