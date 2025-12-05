/**
 * useHomeContent - Hook for personalized home content
 * 
 * Provides:
 * - Continue watching (unfinished content)
 * - Last watched
 * - Recommendations based on viewing history
 * - Random fresh content to keep it interesting
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { profileService } from '../services/profileService';
import { recommendationsService } from '../services/recommendationsService';
import type { Channel, RecommendationItem, RecommendationGroup } from '../types';

export interface ContinueWatchingItem {
  id: string;
  channel: Channel;
  progress: number;
  lastWatched: string;
}

export interface HomeContentSection {
  id: string;
  title: string;
  type: 'continue' | 'recent' | 'recommendation' | 'random' | 'trending';
  items: RecommendationItem[];
}

interface UseHomeContentOptions {
  allChannels: Channel[];
  enabled?: boolean;
}

export function useHomeContent({ allChannels, enabled = true }: UseHomeContentOptions) {
  const [sections, setSections] = useState<HomeContentSection[]>([]);
  const [continueWatching, setContinueWatching] = useState<ContinueWatchingItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const loadHomeContent = useCallback(async () => {
    if (!enabled || allChannels.length === 0) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const profile = await profileService.getCurrentProfile();
      if (!profile) {
        // Return random content for non-authenticated users
        const randomSections = generateRandomSections(allChannels);
        setSections(randomSections);
        setIsLoading(false);
        return;
      }

      // Load all content types in parallel
      const [
        continueWatchingData,
        recentWatched,
        recommendations,
        forYouMix,
      ] = await Promise.all([
        loadContinueWatching(profile.id, allChannels),
        loadRecentWatched(profile.id, allChannels),
        recommendationsService.getRecommendationsByHistory(allChannels, 20),
        recommendationsService.getForYouMix(allChannels, 30),
      ]);

      setContinueWatching(continueWatchingData);

      // Build sections
      const newSections: HomeContentSection[] = [];

      // 1. Continue Watching (unfinished content)
      if (continueWatchingData.length > 0) {
        newSections.push({
          id: 'continue-watching',
          title: '▶️ Continuar Assistindo',
          type: 'continue',
          items: continueWatchingData.map((item, idx) => ({
            id: item.id,
            content_id: item.channel.id,
            content_type: detectContentType(item.channel) as any,
            content_name: item.channel.name,
            content_logo: item.channel.tvg_logo,
            content_category: item.channel.group_title,
            score: 100 - idx,
            reason: `${Math.round(item.progress)}% assistido`,
          })),
        });
      }

      // 2. Last Watched (recent history)
      if (recentWatched.length > 0) {
        newSections.push({
          id: 'recent-watched',
          title: '🕐 Assistidos Recentemente',
          type: 'recent',
          items: recentWatched.slice(0, 10),
        });
      }

      // 3. Recommendations based on history
      for (const group of recommendations) {
        if (group.items.length > 0) {
          newSections.push({
            id: `rec-${group.type}-${group.source_content || 'general'}`,
            title: group.title,
            type: 'recommendation',
            items: shuffleArray(group.items).slice(0, 15), // Randomize order
          });
        }
      }

      // 4. For You Mix (personalized random)
      if (forYouMix.length > 0) {
        newSections.push({
          id: 'for-you-mix',
          title: '✨ Mistura Para Você',
          type: 'random',
          items: shuffleArray(forYouMix),
        });
      }

      // 5. Add random sections to keep content fresh
      const randomSections = generateRandomSections(allChannels, newSections);
      newSections.push(...randomSections);

      setSections(newSections);
    } catch (err) {
      console.error('[useHomeContent] Error:', err);
      setError(err instanceof Error ? err : new Error('Failed to load home content'));
      // Fallback to random content
      setSections(generateRandomSections(allChannels));
    } finally {
      setIsLoading(false);
    }
  }, [allChannels, enabled]);

  useEffect(() => {
    loadHomeContent();
  }, [loadHomeContent]);

  // Refresh with new random content
  const refreshContent = useCallback(() => {
    loadHomeContent();
  }, [loadHomeContent]);

  return {
    sections,
    continueWatching,
    isLoading,
    error,
    refresh: refreshContent,
  };
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

async function loadContinueWatching(
  profileId: string,
  allChannels: Channel[]
): Promise<ContinueWatchingItem[]> {
  const { data, error } = await supabase
    .from('watch_progress')
    .select('*')
    .eq('profile_id', profileId)
    .eq('completed', false)
    .gt('progress_percent', 5) // At least 5% watched
    .lt('progress_percent', 95) // Not almost finished
    .order('updated_at', { ascending: false })
    .limit(20);

  if (error || !data) return [];

  const channelMap = new Map(allChannels.map(ch => [ch.id, ch]));
  const channelNameMap = new Map(allChannels.map(ch => [ch.name.toLowerCase(), ch]));

  return data
    .map(item => {
      const channel = channelMap.get(item.content_id) || 
                      channelNameMap.get(item.content_name?.toLowerCase() || '');
      if (!channel) return null;

      return {
        id: item.id,
        channel,
        progress: item.progress_percent || 0,
        lastWatched: item.updated_at,
      };
    })
    .filter((item): item is ContinueWatchingItem => item !== null);
}

async function loadRecentWatched(
  profileId: string,
  allChannels: Channel[]
): Promise<RecommendationItem[]> {
  const { data, error } = await supabase
    .from('watch_history')
    .select('content_id, content_name, content_type, content_category, watched_at')
    .eq('profile_id', profileId)
    .order('watched_at', { ascending: false })
    .limit(30);

  if (error || !data) return [];

  const channelMap = new Map(allChannels.map(ch => [ch.id, ch]));
  const channelNameMap = new Map(allChannels.map(ch => [ch.name.toLowerCase(), ch]));
  const seen = new Set<string>();

  return data
    .map((item, idx) => {
      const channel = channelMap.get(item.content_id) ||
                      channelNameMap.get(item.content_name?.toLowerCase() || '');
      if (!channel || seen.has(channel.id)) return null;
      seen.add(channel.id);

      return {
        id: channel.id,
        content_id: channel.id,
        content_type: (item.content_type || 'live') as any,
        content_name: channel.name,
        content_logo: channel.tvg_logo,
        content_category: channel.group_title,
        score: 100 - idx,
      } as RecommendationItem;
    })
    .filter((item): item is RecommendationItem => item !== null);
}

function generateRandomSections(
  allChannels: Channel[],
  existingSections: HomeContentSection[] = []
): HomeContentSection[] {
  const sections: HomeContentSection[] = [];
  const existingIds = new Set(existingSections.flatMap(s => s.items.map(i => i.content_id)));

  // Separate by content type
  const liveChannels = allChannels.filter(ch => detectContentType(ch) === 'live' && !existingIds.has(ch.id));
  const movieChannels = allChannels.filter(ch => detectContentType(ch) === 'movie' && !existingIds.has(ch.id));
  const seriesChannels = allChannels.filter(ch => detectContentType(ch) === 'episode' && !existingIds.has(ch.id));

  // Random Live TV
  if (liveChannels.length > 0) {
    const random = shuffleArray(liveChannels).slice(0, 15);
    sections.push({
      id: `random-live-${Date.now()}`,
      title: '📺 Canais ao Vivo',
      type: 'random',
      items: random.map((ch, idx) => ({
        id: ch.id,
        content_id: ch.id,
        content_type: 'live' as any,
        content_name: ch.name,
        content_logo: ch.tvg_logo,
        content_category: ch.group_title,
        score: 100 - idx,
      })),
    });
  }

  // Random Movies
  if (movieChannels.length > 0) {
    const random = shuffleArray(movieChannels).slice(0, 15);
    sections.push({
      id: `random-movies-${Date.now()}`,
      title: '🎬 Filmes Para Você',
      type: 'random',
      items: random.map((ch, idx) => ({
        id: ch.id,
        content_id: ch.id,
        content_type: 'movie' as any,
        content_name: ch.name,
        content_logo: ch.tvg_logo,
        content_category: ch.group_title,
        score: 100 - idx,
      })),
    });
  }

  // Random Series
  if (seriesChannels.length > 0) {
    // Group by series name first
    const seriesMap = new Map<string, Channel>();
    for (const ch of shuffleArray(seriesChannels)) {
      const name = extractSeriesName(ch.name);
      if (!seriesMap.has(name)) {
        seriesMap.set(name, ch);
      }
    }

    const uniqueSeries = Array.from(seriesMap.values()).slice(0, 15);
    if (uniqueSeries.length > 0) {
      sections.push({
        id: `random-series-${Date.now()}`,
        title: '📺 Séries Para Você',
        type: 'random',
        items: uniqueSeries.map((ch, idx) => ({
          id: ch.id,
          content_id: ch.id,
          content_type: 'episode' as any,
          content_name: extractSeriesName(ch.name),
          content_logo: ch.tvg_logo,
          content_category: ch.group_title,
          score: 100 - idx,
        })),
      });
    }
  }

  return sections;
}

function detectContentType(channel: Channel): string {
  const url = (channel.stream_url || '').toLowerCase();
  const name = (channel.name || '').toLowerCase();
  const group = (channel.group_title || channel.category_name || '').toLowerCase();

  if (url.includes('/series/') || /S\d{1,2}\s*E\d{1,3}/i.test(name)) return 'episode';
  if (url.includes('/movie/') || group.includes('filme') || group.includes('movie')) return 'movie';
  if (url.includes('/live/') || group.includes('tv') || group.includes('ao vivo')) return 'live';

  const seriesKw = ['série', 'series', 'temporada', 'season'];
  const movieKw = ['filme', 'movie', 'cinema'];
  const liveKw = ['tv', 'live', 'canais'];

  for (const kw of seriesKw) if (group.includes(kw)) return 'episode';
  for (const kw of movieKw) if (group.includes(kw)) return 'movie';
  for (const kw of liveKw) if (group.includes(kw)) return 'live';

  return 'live';
}

function extractSeriesName(name: string): string {
  return name
    .replace(/\s*S\d{1,2}\s*E\d{1,3}.*/gi, '')
    .replace(/\s*\d{1,2}x\d{1,3}.*/gi, '')
    .replace(/\s*-\s*Temporada\s*\d+.*/gi, '')
    .replace(/\s*Temporada\s*\d+.*/gi, '')
    .replace(/\s*T\d+\s*E?\d*.*/gi, '')
    .replace(/\s*\((\d{4})\)/g, '')
    .trim();
}

function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

export default useHomeContent;
