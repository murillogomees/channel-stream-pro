/**
 * usePersonalizedContent - Optimized hook for personalized home content
 * 
 * Features:
 * - Maximum 500 items total
 * - Priority: Continue Watching > Related > AI Suggestions
 * - Behavior-based recommendations
 */

import { useMemo, useCallback } from 'react';
import type { WatchProgress, Channel, RecommendationGroup, RecommendationItem } from '../types';
import { groupRecommendationItems, detectContentType } from '../utils/contentGrouper';
import { shuffleArray } from '../utils/contentRandomizer';

const MAX_TOTAL_ITEMS = 500;
const MAX_CONTINUE_WATCHING = 20;
const MAX_RELATED_PER_CATEGORY = 30;
const MAX_FOR_YOU = 50;
const MAX_DEFAULT_PER_SECTION = 40;

interface PersonalizedContentInput {
  continueWatchingItems: WatchProgress[];
  seriesContinuations: Array<{
    seriesName: string;
    nextEpisode: Channel;
    currentSeason: number;
    currentEpisode: number;
    progress: number;
    logo?: string;
  }>;
  recommendationGroups: RecommendationGroup[];
  forYouMix: RecommendationItem[];
  allChannels: Channel[];
  sessionKey: string;
}

interface PersonalizedSection {
  id: string;
  title: string;
  subtitle?: string;
  type: 'continue' | 'series' | 'related' | 'foryou' | 'default';
  items: any[];
  priority: number;
}

export function usePersonalizedContent(input: PersonalizedContentInput) {
  const {
    continueWatchingItems,
    seriesContinuations,
    recommendationGroups,
    forYouMix,
    allChannels,
    sessionKey,
  } = input;

  // Calculate total items budget
  const calculateBudget = useCallback(() => {
    let remaining = MAX_TOTAL_ITEMS;
    const budgets = {
      continueWatching: 0,
      seriesContinuations: 0,
      related: 0,
      forYou: 0,
      defaults: 0,
    };

    // Priority 1: Continue Watching (highest priority)
    budgets.continueWatching = Math.min(continueWatchingItems.length, MAX_CONTINUE_WATCHING);
    remaining -= budgets.continueWatching;

    // Priority 2: Series continuations
    budgets.seriesContinuations = Math.min(seriesContinuations.length, 10);
    remaining -= budgets.seriesContinuations;

    // Priority 3: Related content (based on what user watches)
    const totalRelated = recommendationGroups.reduce((sum, g) => sum + g.items.length, 0);
    budgets.related = Math.min(totalRelated, Math.min(remaining * 0.5, 200));
    remaining -= budgets.related;

    // Priority 4: For You mix
    budgets.forYou = Math.min(forYouMix.length, Math.min(remaining * 0.5, MAX_FOR_YOU));
    remaining -= budgets.forYou;

    // Priority 5: Default sections for remaining budget
    budgets.defaults = Math.max(0, remaining);

    return budgets;
  }, [continueWatchingItems.length, seriesContinuations.length, recommendationGroups, forYouMix.length]);

  // Process continue watching (highest priority)
  const processedContinueWatching = useMemo(() => {
    return continueWatchingItems
      .filter(item => item.content_logo) // Only with images
      .sort((a, b) => {
        // Sort by updated_at, most recent first
        const dateA = new Date(a.updated_at || 0).getTime();
        const dateB = new Date(b.updated_at || 0).getTime();
        return dateB - dateA;
      })
      .slice(0, MAX_CONTINUE_WATCHING);
  }, [continueWatchingItems]);

  // Process series continuations
  const processedSeriesContinuations = useMemo(() => {
    return seriesContinuations
      .filter(item => item.logo || item.nextEpisode.tvg_logo)
      .slice(0, 10);
  }, [seriesContinuations]);

  // Process related content (based on user behavior)
  const processedRelated = useMemo(() => {
    const budget = calculateBudget();
    let itemsPerGroup = Math.floor(budget.related / Math.max(1, recommendationGroups.length));
    itemsPerGroup = Math.min(itemsPerGroup, MAX_RELATED_PER_CATEGORY);

    return recommendationGroups.map(group => {
      const withLogos = group.items.filter(item => item.content_logo);
      const grouped = groupRecommendationItems(withLogos);
      const shuffled = shuffleArray(grouped);
      
      return {
        ...group,
        items: shuffled.slice(0, itemsPerGroup),
      };
    }).filter(g => g.items.length > 0);
  }, [recommendationGroups, calculateBudget, sessionKey]);

  // Process For You mix
  const processedForYou = useMemo(() => {
    const withLogos = forYouMix.filter(item => item.content_logo);
    const grouped = groupRecommendationItems(withLogos);
    return shuffleArray(grouped).slice(0, MAX_FOR_YOU);
  }, [forYouMix, sessionKey]);

  // Process default sections for new users
  const processedDefaults = useMemo(() => {
    const hasPersonalized = 
      processedContinueWatching.length > 0 || 
      processedSeriesContinuations.length > 0 ||
      processedRelated.length > 0;

    if (hasPersonalized || allChannels.length === 0) return [];

    const budget = calculateBudget();
    const validChannels = allChannels.filter(ch => ch.tvg_logo);
    
    // Group by content type
    const movies: Channel[] = [];
    const series: Channel[] = [];
    const live: Channel[] = [];
    const seen = new Set<string>();

    for (const ch of validChannels) {
      // Deduplicate by series/content
      const key = ch.name.split(/S\d|E\d|\d+x\d+/i)[0].trim().toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);

      const type = detectContentType(ch);
      if (type === 'movie') movies.push(ch);
      else if (type === 'series') series.push(ch);
      else live.push(ch);
    }

    const perSection = Math.floor(budget.defaults / 3);
    const sections: Array<{ title: string; type: string; channels: Channel[] }> = [];

    if (live.length > 0) {
      sections.push({
        title: '📺 TV ao Vivo',
        type: 'live',
        channels: shuffleArray(live).slice(0, Math.min(perSection, MAX_DEFAULT_PER_SECTION)),
      });
    }
    if (movies.length > 0) {
      sections.push({
        title: '🎬 Filmes',
        type: 'movie',
        channels: shuffleArray(movies).slice(0, Math.min(perSection, MAX_DEFAULT_PER_SECTION)),
      });
    }
    if (series.length > 0) {
      sections.push({
        title: '📺 Séries',
        type: 'series',
        channels: shuffleArray(series).slice(0, Math.min(perSection, MAX_DEFAULT_PER_SECTION)),
      });
    }

    return sections;
  }, [allChannels, processedContinueWatching.length, processedSeriesContinuations.length, processedRelated.length, calculateBudget, sessionKey]);

  // Total count for metrics
  const totalItemCount = useMemo(() => {
    let count = processedContinueWatching.length;
    count += processedSeriesContinuations.length;
    count += processedRelated.reduce((sum, g) => sum + g.items.length, 0);
    count += processedForYou.length;
    count += processedDefaults.reduce((sum, s) => sum + s.channels.length, 0);
    return count;
  }, [processedContinueWatching, processedSeriesContinuations, processedRelated, processedForYou, processedDefaults]);

  // Check if user has personalized content
  const hasPersonalizedContent = useMemo(() => {
    return processedContinueWatching.length > 0 || 
           processedSeriesContinuations.length > 0 ||
           processedRelated.length > 0;
  }, [processedContinueWatching.length, processedSeriesContinuations.length, processedRelated.length]);

  return {
    continueWatching: processedContinueWatching,
    seriesContinuations: processedSeriesContinuations,
    relatedGroups: processedRelated,
    forYouMix: processedForYou,
    defaultSections: processedDefaults,
    hasPersonalizedContent,
    totalItemCount,
    maxItems: MAX_TOTAL_ITEMS,
  };
}

export default usePersonalizedContent;
