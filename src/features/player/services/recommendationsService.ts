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
  RankingType,
  Channel 
} from '../types';

interface WatchHistorySummary {
  category: string;
  count: number;
  lastWatched: string;
}

export interface SeriesContinuation {
  seriesName: string;
  nextEpisode: Channel;
  currentSeason: number;
  currentEpisode: number;
  progress: number;
  logo?: string;
}

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

  /**
   * Get recommendations based on user's watch history categories
   * Content is properly segregated by type (movies with movies, series with series, live with live)
   */
  async getRecommendationsByHistory(
    allChannels: Channel[],
    limit = 20
  ): Promise<RecommendationGroup[]> {
    const profile = await profileService.getCurrentProfile();
    if (!profile) return [];

    try {
      const { data: watchProgress, error } = await supabase
        .from('watch_progress')
        .select('content_category, content_type, content_name, updated_at')
        .eq('profile_id', profile.id)
        .order('updated_at', { ascending: false })
        .limit(100);

      if (error || !watchProgress?.length) {
        return this.getDefaultRecommendationsFromChannels(allChannels, limit);
      }

      // Track stats per content type AND category
      interface TypeCategoryStat {
        contentType: string;
        category: string;
        count: number;
        lastWatched: string;
      }
      
      const typeStats = new Map<string, TypeCategoryStat>();
      
      for (const item of watchProgress) {
        const category = item.content_category || 'Geral';
        const type = item.content_type || 'movie';
        const key = `${type}:${category}`;
        const existing = typeStats.get(key);
        
        if (existing) {
          existing.count++;
          if (item.updated_at > existing.lastWatched) {
            existing.lastWatched = item.updated_at;
          }
        } else {
          typeStats.set(key, {
            contentType: type,
            category,
            count: 1,
            lastWatched: item.updated_at || new Date().toISOString(),
          });
        }
      }

      const topStats = Array.from(typeStats.values())
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);

      const groups: RecommendationGroup[] = [];
      const watchedIds = new Set(watchProgress.map(w => w.content_name.toLowerCase()));

      for (const stat of topStats) {
        // Filter channels that match BOTH category AND content type
        const matchingChannels = allChannels.filter(ch => {
          const chType = this.detectContentType(ch);
          const chCategory = (ch.group_title || ch.category_name || '').toLowerCase();
          
          // Match content type strictly
          const typeMatches = 
            (stat.contentType === 'movie' && chType === 'movie') ||
            (stat.contentType === 'episode' && chType === 'episode') ||
            (stat.contentType === 'live' && chType === 'live');
            
          // Match category loosely
          const categoryMatches = chCategory.includes(stat.category.toLowerCase()) ||
                                  stat.category.toLowerCase().includes(chCategory);
          
          return typeMatches && categoryMatches;
        });

        if (matchingChannels.length > 0) {
          const unwatched = matchingChannels.filter(
            ch => !watchedIds.has(ch.name.toLowerCase())
          );

          const items: RecommendationItem[] = unwatched.slice(0, Math.ceil(limit / topStats.length)).map((ch, idx) => ({
            id: ch.id,
            content_id: ch.id,
            content_type: this.detectContentType(ch) as ContentType,
            content_name: ch.name,
            content_logo: ch.tvg_logo,
            content_category: ch.group_title || ch.category_name,
            reason: `Baseado no que você assistiu`,
            score: 100 - idx,
          }));

          if (items.length > 0) {
            const typeLabel = stat.contentType === 'movie' ? 'filmes' 
              : stat.contentType === 'episode' ? 'séries' : 'canais';
              
            groups.push({
              type: 'because_watched',
              title: `Mais ${typeLabel} de ${stat.category}`,
              source_content: stat.category,
              items,
            });
          }
        }
      }

      return groups;
    } catch (error) {
      console.error('[RecommendationsService] Error:', error);
      return [];
    }
  }

  /**
   * Get series continuations - next episodes for series the user is watching
   */
  async getSeriesContinuations(
    allChannels: Channel[],
    limit = 10
  ): Promise<SeriesContinuation[]> {
    const profile = await profileService.getCurrentProfile();
    if (!profile) return [];

    try {
      const { data: watchProgress, error } = await supabase
        .from('watch_progress')
        .select('*')
        .eq('profile_id', profile.id)
        .eq('content_type', 'episode')
        .eq('completed', false)
        .order('updated_at', { ascending: false })
        .limit(50);

      if (error || !watchProgress?.length) return [];

      const seriesMap = new Map<string, SeriesContinuation>();

      for (const progress of watchProgress) {
        const seriesName = this.extractSeriesName(progress.content_name);
        if (!seriesName || seriesMap.has(seriesName)) continue;

        const episodeInfo = this.parseEpisodeInfo(progress.content_name);
        if (!episodeInfo) continue;

        const nextEpisode = this.findNextEpisode(
          allChannels,
          seriesName,
          episodeInfo.season,
          episodeInfo.episode
        );

        if (nextEpisode) {
          seriesMap.set(seriesName, {
            seriesName,
            nextEpisode,
            currentSeason: episodeInfo.season,
            currentEpisode: episodeInfo.episode,
            progress: progress.progress_percent || 0,
            logo: progress.content_logo || nextEpisode.tvg_logo,
          });
        }
      }

      return Array.from(seriesMap.values()).slice(0, limit);
    } catch (error) {
      console.error('[RecommendationsService] Error getting series continuations:', error);
      return [];
    }
  }

  /**
   * Get personalized "For You" mix - separated by content type
   * Returns content grouped by type, prioritizing user's preferred types
   */
  async getForYouMix(
    allChannels: Channel[],
    limit = 30
  ): Promise<RecommendationItem[]> {
    const profile = await profileService.getCurrentProfile();
    if (!profile) return [];

    try {
      const { data: watchProgress } = await supabase
        .from('watch_progress')
        .select('content_category, content_type')
        .eq('profile_id', profile.id)
        .limit(100);

      const typePreference = new Map<string, number>();
      const categoryPreference = new Map<string, number>();

      for (const item of watchProgress || []) {
        const t = item.content_type || 'movie';
        const c = item.content_category || 'Geral';
        typePreference.set(t, (typePreference.get(t) || 0) + 1);
        categoryPreference.set(c, (categoryPreference.get(c) || 0) + 1);
      }

      // Separate channels by type first
      const movieChannels: Channel[] = [];
      const seriesChannels: Channel[] = [];
      const liveChannels: Channel[] = [];
      
      for (const ch of allChannels) {
        const type = this.detectContentType(ch);
        if (type === 'movie') movieChannels.push(ch);
        else if (type === 'episode') seriesChannels.push(ch);
        else liveChannels.push(ch);
      }

      // Score and sort each type separately
      const scoreChannel = (ch: Channel) => {
        let score = Math.random() * 10;
        const category = ch.group_title || ch.category_name || 'Geral';
        score += (categoryPreference.get(category) || 0) * 5;
        return score;
      };

      const topMovies = movieChannels
        .map(ch => ({ channel: ch, score: scoreChannel(ch) }))
        .sort((a, b) => b.score - a.score)
        .slice(0, Math.ceil(limit / 3));

      const topSeries = seriesChannels
        .map(ch => ({ channel: ch, score: scoreChannel(ch) }))
        .sort((a, b) => b.score - a.score)
        .slice(0, Math.ceil(limit / 3));

      const topLive = liveChannels
        .map(ch => ({ channel: ch, score: scoreChannel(ch) }))
        .sort((a, b) => b.score - a.score)
        .slice(0, Math.ceil(limit / 3));

      // Prioritize by user preference
      const allScored = [...topMovies, ...topSeries, ...topLive];
      allScored.sort((a, b) => {
        const typeA = this.detectContentType(a.channel);
        const typeB = this.detectContentType(b.channel);
        const prefA = typePreference.get(typeA) || 0;
        const prefB = typePreference.get(typeB) || 0;
        if (prefA !== prefB) return prefB - prefA;
        return b.score - a.score;
      });

      return allScored.slice(0, limit).map((item) => ({
        id: item.channel.id,
        content_id: item.channel.id,
        content_type: this.detectContentType(item.channel) as ContentType,
        content_name: item.channel.name,
        content_logo: item.channel.tvg_logo,
        content_category: item.channel.group_title || item.channel.category_name,
        score: item.score,
      }));
    } catch (error) {
      console.error('[RecommendationsService] Error getting for you mix:', error);
      return [];
    }
  }

  // ============================================================================
  // PRIVATE HELPERS
  // ============================================================================

  private getDefaultRecommendationsFromChannels(channels: Channel[], limit: number): RecommendationGroup[] {
    // Separate channels by type first
    const movieChannels: Channel[] = [];
    const seriesChannels: Channel[] = [];
    const liveChannels: Channel[] = [];
    
    for (const ch of channels) {
      const type = this.detectContentType(ch);
      if (type === 'movie') movieChannels.push(ch);
      else if (type === 'episode') seriesChannels.push(ch);
      else liveChannels.push(ch);
    }

    const groups: RecommendationGroup[] = [];
    const perGroup = Math.ceil(limit / 3);
    
    // Add Live TV section
    if (liveChannels.length > 0) {
      groups.push({
        type: 'trending',
        title: '📺 TV ao Vivo em Alta',
        items: liveChannels.slice(0, perGroup).map((ch, idx) => ({
          id: ch.id,
          content_id: ch.id,
          content_type: 'live' as ContentType,
          content_name: ch.name,
          content_logo: ch.tvg_logo,
          content_category: ch.group_title || ch.category_name,
          score: 100 - idx,
        })),
      });
    }
    
    // Add Movies section
    if (movieChannels.length > 0) {
      groups.push({
        type: 'trending',
        title: '🎬 Filmes Populares',
        items: movieChannels.slice(0, perGroup).map((ch, idx) => ({
          id: ch.id,
          content_id: ch.id,
          content_type: 'movie' as ContentType,
          content_name: ch.name,
          content_logo: ch.tvg_logo,
          content_category: ch.group_title || ch.category_name,
          score: 100 - idx,
        })),
      });
    }
    
    // Add Series section (group by series name)
    if (seriesChannels.length > 0) {
      const seriesMap = new Map<string, Channel>();
      for (const ch of seriesChannels) {
        const seriesName = this.extractSeriesName(ch.name);
        if (!seriesMap.has(seriesName)) {
          seriesMap.set(seriesName, ch);
        }
      }
      
      groups.push({
        type: 'trending',
        title: '📺 Séries Populares',
        items: Array.from(seriesMap.values()).slice(0, perGroup).map((ch, idx) => ({
          id: ch.id,
          content_id: ch.id,
          content_type: 'episode' as ContentType,
          content_name: this.extractSeriesName(ch.name),
          content_logo: ch.tvg_logo,
          content_category: ch.group_title || ch.category_name,
          score: 100 - idx,
        })),
      });
    }

    return groups;
  }

  /**
   * Detect content type from channel data
   */
  detectContentType(channel: Channel): string {
    const url = channel.stream_url?.toLowerCase() || '';
    const name = channel.name?.toLowerCase() || '';
    const group = (channel.group_title || channel.category_name || '').toLowerCase();

    // Series detection - check URL pattern and name patterns
    const seriesKeywords = ['série', 'series', 'seriado', 'novela', 'temporada', 'season', 'episódio', 'dorama', 'anime'];
    const movieKeywords = ['filme', 'movie', 'cinema', 'vod filme', 'filmes', 'movies', 'film', 'peliculas', 'lançamento'];
    const liveKeywords = ['tv', 'live', 'ao vivo', 'canais', 'abertos', 'esportes', 'notícias', '24h', '24 horas'];
    
    // URL-based detection (most reliable)
    if (url.includes('/series/')) {
      return 'episode';
    }
    if (url.includes('/movie/')) {
      return 'movie';
    }
    if (url.includes('/live/')) {
      return 'live';
    }
    
    // Episode pattern in name
    if (/S\d{1,2}\s*E\d{1,3}/i.test(name) || /\d{1,2}x\d{1,3}/i.test(name) || /Temporada\s*\d+/i.test(name)) {
      return 'episode';
    }
    
    // Group/category-based detection
    const isSeriesCategory = seriesKeywords.some(kw => group.includes(kw)) && 
                             !movieKeywords.some(kw => group.includes(kw));
    const isMovieCategory = movieKeywords.some(kw => group.includes(kw)) &&
                            !seriesKeywords.some(kw => group.includes(kw));
    const isLiveCategory = liveKeywords.some(kw => group.includes(kw)) &&
                           !movieKeywords.some(kw => group.includes(kw)) &&
                           !seriesKeywords.some(kw => group.includes(kw));
    
    if (isSeriesCategory) return 'episode';
    if (isMovieCategory) return 'movie';
    if (isLiveCategory) return 'live';
    
    // Default to live for unknown content (most common in IPTV)
    return 'live';
  }

  private extractSeriesName(episodeName: string): string {
    return episodeName
      .replace(/\s*S\d{1,2}\s*E\d{1,3}.*/gi, '')
      .replace(/\s*\d{1,2}x\d{1,3}.*/gi, '')
      .replace(/\s*-\s*Temporada\s*\d+.*/gi, '')
      .replace(/\s*Temporada\s*\d+.*/gi, '')
      .replace(/\s*Season\s*\d+.*/gi, '')
      .replace(/\s*T\d+\s*E?\d*.*/gi, '')
      .replace(/\s*Ep[is]*[óo]*d?i?o?\s*\d+.*/gi, '')
      .replace(/\s*\(\d{4}\)/g, '')
      .replace(/\s*\[.*?\]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private parseEpisodeInfo(name: string): { season: number; episode: number } | null {
    let match = name.match(/S(\d{1,2})\s*E(\d{1,3})/i);
    if (match) {
      return { season: parseInt(match[1]), episode: parseInt(match[2]) };
    }
    
    match = name.match(/(\d{1,2})x(\d{1,3})/i);
    if (match) {
      return { season: parseInt(match[1]), episode: parseInt(match[2]) };
    }
    
    match = name.match(/Temporada\s*(\d+).*Epis[óo]dio\s*(\d+)/i);
    if (match) {
      return { season: parseInt(match[1]), episode: parseInt(match[2]) };
    }

    return null;
  }

  private findNextEpisode(
    allChannels: Channel[],
    seriesName: string,
    currentSeason: number,
    currentEpisode: number
  ): Channel | null {
    const seriesEpisodes = allChannels.filter(ch => {
      const name = this.extractSeriesName(ch.name);
      return name.toLowerCase() === seriesName.toLowerCase();
    });

    const parsed = seriesEpisodes.map(ch => ({
      channel: ch,
      info: this.parseEpisodeInfo(ch.name),
    })).filter(p => p.info !== null);

    parsed.sort((a, b) => {
      if (a.info!.season !== b.info!.season) {
        return a.info!.season - b.info!.season;
      }
      return a.info!.episode - b.info!.episode;
    });

    for (const p of parsed) {
      if (p.info!.season > currentSeason || 
          (p.info!.season === currentSeason && p.info!.episode > currentEpisode)) {
        return p.channel;
      }
    }

    return null;
  }
}

export const recommendationsService = new RecommendationsService();
export default recommendationsService;
