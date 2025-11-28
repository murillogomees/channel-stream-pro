/**
 * Recommendations Service - AI-powered content recommendations
 */

import { supabase } from '@/integrations/supabase/client';
import { profileService } from './profileService';
import type { 
  RecommendationGroup, 
  RecommendationItem, 
  TrendingItem, 
  ContentType,
  RecommendationType,
  RankingType 
} from '../types';

// Helper to map DB trending to typed trending
function mapDbTrending(data: any): TrendingItem {
  return {
    id: data.id,
    content_id: data.content_id,
    content_type: data.content_type as ContentType,
    content_name: data.content_name,
    content_logo: data.content_logo,
    content_category: data.content_category,
    ranking_type: data.ranking_type as RankingType,
    rank_position: data.rank_position,
    view_count: data.view_count || 0,
    score: data.score || 0,
    ranking_date: data.ranking_date,
  };
}

class RecommendationsService {
  /**
   * Get trending content
   */
  async getTrending(
    type: RankingType = 'weekly',
    contentType?: ContentType,
    limit = 10
  ): Promise<TrendingItem[]> {
    let query = supabase
      .from('trending_rankings')
      .select('*')
      .eq('ranking_type', type)
      .order('rank_position', { ascending: true })
      .limit(limit);

    if (contentType) {
      query = query.eq('content_type', contentType);
    }

    const { data, error } = await query;

    if (error) {
      console.error('[RecommendationsService] Error getting trending:', error);
      return [];
    }

    return (data || []).map(mapDbTrending);
  }

  /**
   * Get personalized recommendations
   */
  async getRecommendations(limit = 20): Promise<RecommendationGroup[]> {
    const profile = await profileService.getCurrentProfile();
    if (!profile) return [];

    const groups: RecommendationGroup[] = [];

    // Get cached recommendations
    const { data: cached } = await supabase
      .from('recommendations_cache')
      .select('*')
      .eq('profile_id', profile.id)
      .gte('expires_at', new Date().toISOString());

    if (cached && cached.length > 0) {
      for (const cache of cached) {
        const items = Array.isArray(cache.recommended_items) 
          ? cache.recommended_items as unknown as RecommendationItem[]
          : [];
        
        groups.push({
          type: cache.recommendation_type as RecommendationType,
          title: this.getRecommendationTitle(cache.recommendation_type, cache.source_content_id || undefined),
          source_content: cache.source_content_id || undefined,
          items,
        });
      }
      return groups;
    }

    // Generate new recommendations based on watch history
    const recommendations = await this.generateRecommendations(profile.id, limit);
    return recommendations;
  }

  /**
   * Generate recommendations based on user behavior
   */
  private async generateRecommendations(
    profileId: string,
    limit: number
  ): Promise<RecommendationGroup[]> {
    const groups: RecommendationGroup[] = [];

    // Get watch history
    const { data: history } = await supabase
      .from('watch_history')
      .select('content_id, content_type, content_category, watched_at')
      .eq('profile_id', profileId)
      .order('watched_at', { ascending: false })
      .limit(50);

    if (!history || history.length === 0) {
      // Return trending for new users
      const trending = await this.getTrending('weekly');
      if (trending.length > 0) {
        groups.push({
          type: 'trending',
          title: 'Em Alta',
          items: trending.map(t => ({
            id: t.id,
            content_id: t.content_id,
            content_type: t.content_type,
            content_name: t.content_name,
            content_logo: t.content_logo,
            content_category: t.content_category,
            score: t.score,
          })),
        });
      }
      return groups;
    }

    // Analyze user preferences
    const categoryCount = new Map<string, number>();
    const typeCount = new Map<string, number>();

    for (const item of history) {
      if (item.content_category) {
        categoryCount.set(
          item.content_category,
          (categoryCount.get(item.content_category) || 0) + 1
        );
      }
      typeCount.set(
        item.content_type,
        (typeCount.get(item.content_type) || 0) + 1
      );
    }

    // Get top categories
    const topCategories = Array.from(categoryCount.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([cat]) => cat);

    // "Because you watched" - based on last watched
    const lastWatched = history[0];
    if (lastWatched) {
      groups.push({
        type: 'because_watched',
        title: `Porque você assistiu ${lastWatched.content_id}`,
        source_content: lastWatched.content_id,
        items: [], // Would be populated with similar content
      });
    }

    // Genre-based recommendations
    if (topCategories.length > 0) {
      groups.push({
        type: 'genre_based',
        title: `Mais de ${topCategories[0]}`,
        items: [], // Would be populated with content from this category
      });
    }

    // Time-based recommendations
    const currentHour = new Date().getHours();
    let timeBasedTitle = 'Para Você Agora';
    
    if (currentHour >= 6 && currentHour < 12) {
      timeBasedTitle = 'Para Sua Manhã';
    } else if (currentHour >= 12 && currentHour < 18) {
      timeBasedTitle = 'Para Sua Tarde';
    } else if (currentHour >= 18 && currentHour < 22) {
      timeBasedTitle = 'Para Sua Noite';
    } else {
      timeBasedTitle = 'Madrugada de Filmes';
    }

    groups.push({
      type: 'time_based',
      title: timeBasedTitle,
      items: [],
    });

    return groups;
  }

  /**
   * Get recommendation title based on type
   */
  private getRecommendationTitle(type: string, sourceContent?: string): string {
    switch (type) {
      case 'similar':
        return 'Similares';
      case 'because_watched':
        return sourceContent ? `Porque você assistiu` : 'Baseado no que você viu';
      case 'trending':
        return 'Em Alta';
      case 'time_based':
        return 'Para Você Agora';
      case 'genre_based':
        return 'Baseado nos seus gostos';
      default:
        return 'Recomendados';
    }
  }

  /**
   * Record content view for recommendations
   */
  async recordView(
    contentId: string,
    contentType: ContentType,
    options?: {
      category?: string;
      watchDuration?: number;
    }
  ): Promise<void> {
    const profile = await profileService.getCurrentProfile();
    if (!profile) return;

    const now = new Date();
    
    await supabase.from('player_analytics').insert({
      profile_id: profile.id,
      content_id: contentId,
      content_type: contentType,
      event_type: 'play',
      event_data: {
        category: options?.category,
        duration: options?.watchDuration,
      },
      watch_hour: now.getHours(),
      watch_day: now.getDay(),
    });

    // Update channel usage stats for live content
    if (contentType === 'live') {
      await supabase.rpc('record_channel_view', {
        p_profile_id: profile.id,
        p_channel_id: contentId,
        p_watch_seconds: options?.watchDuration || 0,
      });
    }
  }

  /**
   * Get smart channel list (sorted by usage)
   */
  async getSmartChannelOrder(channelIds: string[]): Promise<string[]> {
    const profile = await profileService.getCurrentProfile();
    if (!profile) return channelIds;

    const { data } = await supabase
      .from('channel_usage_stats')
      .select('channel_id, view_count, last_watched_at')
      .eq('profile_id', profile.id)
      .in('channel_id', channelIds)
      .order('view_count', { ascending: false });

    if (!data || data.length === 0) return channelIds;

    // Create a map of channel positions based on usage
    const usageMap = new Map(data.map((d, i) => [d.channel_id, i]));
    
    // Sort channels: frequently used first, then the rest
    return channelIds.sort((a, b) => {
      const aPos = usageMap.get(a) ?? Infinity;
      const bPos = usageMap.get(b) ?? Infinity;
      return aPos - bPos;
    });
  }
}

export const recommendationsService = new RecommendationsService();
export default recommendationsService;
