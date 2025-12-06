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

  // Global ID tracker to prevent duplicates across all sections
  const usedIds = useMemo(() => new Set<string>(), [sessionKey]);

  // Helper to generate unique key with index fallback
  const getUniqueKey = useCallback((item: any, sectionPrefix: string, index: number): string => {
    const baseId = item.id || item.content_id || item.channel_id || '';
    let key = `${sectionPrefix}-${baseId}`;
    
    // If already used, append index
    if (usedIds.has(key)) {
      key = `${sectionPrefix}-${baseId}-${index}`;
    }
    
    usedIds.add(key);
    return key;
  }, [usedIds]);

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

  // Process continue watching (highest priority) - deduplicated
  const processedContinueWatching = useMemo(() => {
    usedIds.clear(); // Reset for each calculation
    
    const uniqueItems: WatchProgress[] = [];
    const seenContentIds = new Set<string>();
    
    const sorted = [...continueWatchingItems]
      .filter(item => item.content_logo)
      .sort((a, b) => {
        const dateA = new Date(a.updated_at || 0).getTime();
        const dateB = new Date(b.updated_at || 0).getTime();
        return dateB - dateA;
      });
    
    for (const item of sorted) {
      const contentKey = item.content_id || item.id;
      if (!seenContentIds.has(contentKey)) {
        seenContentIds.add(contentKey);
        uniqueItems.push({
          ...item,
          _uniqueKey: `cw-${contentKey}-${uniqueItems.length}`,
        } as WatchProgress & { _uniqueKey: string });
        usedIds.add(contentKey);
      }
      if (uniqueItems.length >= MAX_CONTINUE_WATCHING) break;
    }
    
    return uniqueItems;
  }, [continueWatchingItems, usedIds]);

  // Process series continuations - deduplicated
  const processedSeriesContinuations = useMemo(() => {
    const uniqueItems: typeof seriesContinuations = [];
    const seenSeries = new Set<string>();
    
    for (const item of seriesContinuations) {
      const seriesKey = item.seriesName.toLowerCase().trim();
      const channelId = item.nextEpisode?.id || '';
      
      if (!seenSeries.has(seriesKey) && !usedIds.has(channelId)) {
        seenSeries.add(seriesKey);
        usedIds.add(channelId);
        uniqueItems.push({
          ...item,
          _uniqueKey: `sc-${channelId}-${uniqueItems.length}`,
        } as any);
      }
      if (uniqueItems.length >= 10) break;
    }
    
    return uniqueItems.filter(item => item.logo || item.nextEpisode.tvg_logo);
  }, [seriesContinuations, usedIds]);

  // Process related content - deduplicated
  const processedRelated = useMemo(() => {
    const budget = calculateBudget();
    let itemsPerGroup = Math.floor(budget.related / Math.max(1, recommendationGroups.length));
    itemsPerGroup = Math.min(itemsPerGroup, MAX_RELATED_PER_CATEGORY);

    return recommendationGroups.map((group, groupIndex) => {
      const uniqueItems: any[] = [];
      const withLogos = group.items.filter(item => item.content_logo);
      const grouped = groupRecommendationItems(withLogos);
      const shuffled = shuffleArray(grouped);
      
      for (const item of shuffled) {
        const contentId = item.content_id || item.id || '';
        if (!usedIds.has(contentId)) {
          usedIds.add(contentId);
          uniqueItems.push({
            ...item,
            _uniqueKey: `rel-${groupIndex}-${contentId}-${uniqueItems.length}`,
          });
        }
        if (uniqueItems.length >= itemsPerGroup) break;
      }
      
      return {
        ...group,
        items: uniqueItems,
      };
    }).filter(g => g.items.length > 0);
  }, [recommendationGroups, calculateBudget, usedIds, sessionKey]);

  // Process For You mix - deduplicated
  const processedForYou = useMemo(() => {
    const withLogos = forYouMix.filter(item => item.content_logo);
    const grouped = groupRecommendationItems(withLogos);
    const shuffled = shuffleArray(grouped);
    
    const uniqueItems: any[] = [];
    for (const item of shuffled) {
      const contentId = item.content_id || item.id || '';
      if (!usedIds.has(contentId)) {
        usedIds.add(contentId);
        uniqueItems.push({
          ...item,
          _uniqueKey: `fy-${contentId}-${uniqueItems.length}`,
        });
      }
      if (uniqueItems.length >= MAX_FOR_YOU) break;
    }
    
    return uniqueItems;
  }, [forYouMix, usedIds, sessionKey]);

  // Process default sections - deduplicated
  const processedDefaults = useMemo(() => {
    const hasPersonalized = 
      processedContinueWatching.length > 0 || 
      processedSeriesContinuations.length > 0 ||
      processedRelated.length > 0;

    if (hasPersonalized || allChannels.length === 0) return [];

    const budget = calculateBudget();
    const validChannels = allChannels.filter(ch => ch.tvg_logo);
    
    // Group by content type
    const movies: Array<Channel & { _uniqueKey: string }> = [];
    const series: Array<Channel & { _uniqueKey: string }> = [];
    const live: Array<Channel & { _uniqueKey: string }> = [];
    const seen = new Set<string>();

    for (const ch of validChannels) {
      // Deduplicate by series/content and global ID
      const key = ch.name.split(/S\d|E\d|\d+x\d+/i)[0].trim().toLowerCase();
      if (seen.has(key) || usedIds.has(ch.id)) continue;
      seen.add(key);
      usedIds.add(ch.id);

      const channelWithKey = {
        ...ch,
        _uniqueKey: `def-${ch.id}-${seen.size}`,
      };

      const type = detectContentType(ch);
      if (type === 'movie') movies.push(channelWithKey);
      else if (type === 'series') series.push(channelWithKey);
      else live.push(channelWithKey);
    }

    const perSection = Math.floor(budget.defaults / 3);
    const sections: Array<{ title: string; type: string; channels: Array<Channel & { _uniqueKey: string }> }> = [];

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
  }, [allChannels, processedContinueWatching.length, processedSeriesContinuations.length, processedRelated.length, calculateBudget, usedIds, sessionKey]);

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
    getUniqueKey,
  };
}

export default usePersonalizedContent;
