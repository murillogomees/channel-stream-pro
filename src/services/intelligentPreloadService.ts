/**
 * ============================================================================
 * Intelligent Preload Service
 * ============================================================================
 * 
 * Netflix-style intelligent preloading based on:
 * - User behavior patterns
 * - Time-based predictions
 * - Popular/trending content
 * - Adjacent channels in current context
 */

import { supabase } from '@/integrations/supabase/client';

export interface PreloadCandidate {
  id: string;
  url: string;
  name: string;
  priority: 'high' | 'medium' | 'low';
  reason: PreloadReason;
  score: number;
}

export type PreloadReason = 
  | 'adjacent_channel'
  | 'user_favorite'
  | 'frequently_watched'
  | 'time_based'
  | 'trending'
  | 'continue_watching';

interface ChannelUsage {
  channel_id: string;
  view_count: number;
  last_watched_at: string;
}

interface PreloadContext {
  currentChannelId?: string;
  currentCategoryId?: string;
  channelList?: Array<{ id: string; stream_url: string; name: string }>;
  profileId?: string;
}

class IntelligentPreloadService {
  private cache = new Map<string, PreloadCandidate[]>();
  private cacheTTL = 60000; // 1 minute
  private lastCacheTime = 0;

  /**
   * Get smart preload candidates based on context
   */
  async getPreloadCandidates(context: PreloadContext): Promise<PreloadCandidate[]> {
    const candidates: PreloadCandidate[] = [];
    const now = Date.now();

    // Check cache
    const cacheKey = `${context.currentChannelId}_${context.profileId}`;
    if (this.cache.has(cacheKey) && now - this.lastCacheTime < this.cacheTTL) {
      return this.cache.get(cacheKey)!;
    }

    // 1. Adjacent channels (highest priority for zapping)
    if (context.channelList && context.currentChannelId) {
      const adjacentCandidates = this.getAdjacentChannels(
        context.channelList,
        context.currentChannelId
      );
      candidates.push(...adjacentCandidates);
    }

    // 2. Frequently watched channels
    if (context.profileId) {
      const frequentCandidates = await this.getFrequentlyWatched(
        context.profileId,
        context.channelList
      );
      candidates.push(...frequentCandidates);
    }

    // 3. Time-based predictions
    if (context.profileId) {
      const timeBasedCandidates = await this.getTimeBasedPredictions(
        context.profileId,
        context.channelList
      );
      candidates.push(...timeBasedCandidates);
    }

    // 4. Trending content
    const trendingCandidates = await this.getTrendingChannels(context.channelList);
    candidates.push(...trendingCandidates);

    // Deduplicate and sort by score
    const uniqueCandidates = this.deduplicateAndSort(candidates);
    
    // Cache results
    this.cache.set(cacheKey, uniqueCandidates);
    this.lastCacheTime = now;

    return uniqueCandidates.slice(0, 5); // Max 5 preloads
  }

  /**
   * Get adjacent channels (prev/next) for fast zapping
   */
  private getAdjacentChannels(
    channelList: Array<{ id: string; stream_url: string; name: string }>,
    currentChannelId: string
  ): PreloadCandidate[] {
    const currentIndex = channelList.findIndex(c => c.id === currentChannelId);
    if (currentIndex === -1) return [];

    const candidates: PreloadCandidate[] = [];

    // Previous channel
    if (currentIndex > 0) {
      const prev = channelList[currentIndex - 1];
      candidates.push({
        id: prev.id,
        url: prev.stream_url,
        name: prev.name,
        priority: 'high',
        reason: 'adjacent_channel',
        score: 100,
      });
    }

    // Next channel
    if (currentIndex < channelList.length - 1) {
      const next = channelList[currentIndex + 1];
      candidates.push({
        id: next.id,
        url: next.stream_url,
        name: next.name,
        priority: 'high',
        reason: 'adjacent_channel',
        score: 100,
      });
    }

    // Also preload +2 and -2 with medium priority
    if (currentIndex > 1) {
      const prev2 = channelList[currentIndex - 2];
      candidates.push({
        id: prev2.id,
        url: prev2.stream_url,
        name: prev2.name,
        priority: 'medium',
        reason: 'adjacent_channel',
        score: 70,
      });
    }

    if (currentIndex < channelList.length - 2) {
      const next2 = channelList[currentIndex + 2];
      candidates.push({
        id: next2.id,
        url: next2.stream_url,
        name: next2.name,
        priority: 'medium',
        reason: 'adjacent_channel',
        score: 70,
      });
    }

    return candidates;
  }

  /**
   * Get frequently watched channels for this user
   */
  private async getFrequentlyWatched(
    profileId: string,
    channelList?: Array<{ id: string; stream_url: string; name: string }>
  ): Promise<PreloadCandidate[]> {
    try {
      const { data, error } = await supabase
        .from('channel_usage_stats')
        .select('channel_id, view_count, last_watched_at')
        .eq('profile_id', profileId)
        .order('view_count', { ascending: false })
        .limit(10);

      if (error || !data) return [];

      const candidates: PreloadCandidate[] = [];
      
      for (const usage of data as ChannelUsage[]) {
        const channel = channelList?.find(c => c.id === usage.channel_id);
        if (channel) {
          candidates.push({
            id: channel.id,
            url: channel.stream_url,
            name: channel.name,
            priority: 'medium',
            reason: 'frequently_watched',
            score: Math.min(50 + usage.view_count * 2, 90),
          });
        }
      }

      return candidates;
    } catch (err) {
      console.debug('[IntelligentPreload] Error fetching frequent channels:', err);
      return [];
    }
  }

  /**
   * Get time-based predictions (what user watches at this hour)
   */
  private async getTimeBasedPredictions(
    profileId: string,
    channelList?: Array<{ id: string; stream_url: string; name: string }>
  ): Promise<PreloadCandidate[]> {
    const currentHour = new Date().getHours();
    const hourRange = [
      (currentHour - 1 + 24) % 24,
      currentHour,
      (currentHour + 1) % 24,
    ];

    try {
      const { data, error } = await supabase
        .from('player_analytics')
        .select('content_id')
        .eq('profile_id', profileId)
        .eq('content_type', 'live')
        .in('watch_hour', hourRange)
        .limit(20);

      if (error || !data) return [];

      // Count frequency
      const channelCounts = new Map<string, number>();
      for (const item of data) {
        const count = channelCounts.get(item.content_id) || 0;
        channelCounts.set(item.content_id, count + 1);
      }

      const candidates: PreloadCandidate[] = [];
      
      for (const [channelId, count] of channelCounts) {
        const channel = channelList?.find(c => c.id === channelId);
        if (channel && count >= 2) {
          candidates.push({
            id: channel.id,
            url: channel.stream_url,
            name: channel.name,
            priority: 'medium',
            reason: 'time_based',
            score: Math.min(40 + count * 5, 80),
          });
        }
      }

      return candidates;
    } catch (err) {
      console.debug('[IntelligentPreload] Error fetching time-based:', err);
      return [];
    }
  }

  /**
   * Get trending channels from analytics
   */
  private async getTrendingChannels(
    channelList?: Array<{ id: string; stream_url: string; name: string }>
  ): Promise<PreloadCandidate[]> {
    try {
      const { data, error } = await supabase
        .from('trending_rankings')
        .select('content_id, rank_position, view_count')
        .eq('content_type', 'live')
        .eq('ranking_type', 'daily')
        .order('rank_position', { ascending: true })
        .limit(10);

      if (error || !data) return [];

      const candidates: PreloadCandidate[] = [];
      
      for (const trending of data) {
        const channel = channelList?.find(c => c.id === trending.content_id);
        if (channel) {
          candidates.push({
            id: channel.id,
            url: channel.stream_url,
            name: channel.name,
            priority: 'low',
            reason: 'trending',
            score: 60 - trending.rank_position * 5,
          });
        }
      }

      return candidates;
    } catch (err) {
      console.debug('[IntelligentPreload] Error fetching trending:', err);
      return [];
    }
  }

  /**
   * Deduplicate candidates and sort by score
   */
  private deduplicateAndSort(candidates: PreloadCandidate[]): PreloadCandidate[] {
    const seen = new Map<string, PreloadCandidate>();
    
    for (const candidate of candidates) {
      const existing = seen.get(candidate.id);
      if (!existing || candidate.score > existing.score) {
        seen.set(candidate.id, candidate);
      }
    }

    return Array.from(seen.values()).sort((a, b) => b.score - a.score);
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    this.cache.clear();
    this.lastCacheTime = 0;
  }
}

export const intelligentPreloadService = new IntelligentPreloadService();
export default intelligentPreloadService;
