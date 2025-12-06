/**
 * usePersonalizedContent - Stable hook for personalized home content
 * 
 * Features:
 * - Maximum 500 items total
 * - Append-only updates (no visual jumps)
 * - Stable keys across renders
 * - No re-ordering of existing items
 */

import { useMemo, useRef } from 'react';
import type { WatchProgress, Channel, RecommendationGroup, RecommendationItem } from '../types';
import { groupRecommendationItems, detectContentType } from '../utils/contentGrouper';

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

// Stable unique key counter
let globalKeyCounter = 0;

// Generate deterministic unique key
function getStableKey(contentId: string, prefix: string): string {
  return `${prefix}_${contentId}_${++globalKeyCounter}`;
}

// Stable shuffle using session key (same session = same order)
function stableShuffleWithSeed<T>(array: T[], seed: string): T[] {
  if (array.length <= 1) return [...array];
  
  const result = [...array];
  let seedNum = 0;
  for (let i = 0; i < seed.length; i++) {
    seedNum = ((seedNum << 5) - seedNum + seed.charCodeAt(i)) | 0;
  }
  
  for (let i = result.length - 1; i > 0; i--) {
    seedNum = (seedNum * 1103515245 + 12345) & 0x7fffffff;
    const j = seedNum % (i + 1);
    [result[i], result[j]] = [result[j], result[i]];
  }
  
  return result;
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

  // Refs to maintain stable state across renders (append-only)
  const processedIdsRef = useRef<Set<string>>(new Set());
  const stableKeysRef = useRef<Map<string, string>>(new Map());
  
  // Get or create stable key for an item
  const getOrCreateStableKey = (id: string, prefix: string): string => {
    const cacheKey = `${prefix}:${id}`;
    if (!stableKeysRef.current.has(cacheKey)) {
      stableKeysRef.current.set(cacheKey, getStableKey(id, prefix));
    }
    return stableKeysRef.current.get(cacheKey)!;
  };

  // Process all content in a single stable pass
  const processedContent = useMemo(() => {
    // Track used IDs within this processing pass
    const usedIds = new Set<string>();
    let remaining = MAX_TOTAL_ITEMS;
    
    // 1. Process Continue Watching (highest priority)
    const continueWatching: Array<WatchProgress & { _uniqueKey: string }> = [];
    const sortedContinue = [...continueWatchingItems]
      .filter(item => item.content_logo)
      .sort((a, b) => {
        const dateA = new Date(a.updated_at || 0).getTime();
        const dateB = new Date(b.updated_at || 0).getTime();
        return dateB - dateA;
      });
    
    for (const item of sortedContinue) {
      if (continueWatching.length >= MAX_CONTINUE_WATCHING) break;
      const contentId = item.content_id || item.id || '';
      if (usedIds.has(contentId)) continue;
      
      usedIds.add(contentId);
      continueWatching.push({
        ...item,
        _uniqueKey: getOrCreateStableKey(contentId, 'cw'),
      });
    }
    remaining -= continueWatching.length;

    // 2. Process Series Continuations
    const processedSeries: Array<typeof seriesContinuations[0] & { _uniqueKey: string }> = [];
    const seenSeries = new Set<string>();
    
    for (const item of seriesContinuations) {
      if (processedSeries.length >= 10) break;
      
      const seriesKey = item.seriesName.toLowerCase().trim();
      const channelId = item.nextEpisode?.id || '';
      
      if (seenSeries.has(seriesKey) || usedIds.has(channelId)) continue;
      if (!item.logo && !item.nextEpisode?.tvg_logo) continue;
      
      seenSeries.add(seriesKey);
      usedIds.add(channelId);
      processedSeries.push({
        ...item,
        _uniqueKey: getOrCreateStableKey(channelId, 'sc'),
      });
    }
    remaining -= processedSeries.length;

    // 3. Process Related Groups (stable order per session)
    const totalRelatedBudget = Math.min(remaining * 0.5, 200);
    const itemsPerGroup = Math.floor(totalRelatedBudget / Math.max(1, recommendationGroups.length));
    const cappedItemsPerGroup = Math.min(itemsPerGroup, MAX_RELATED_PER_CATEGORY);
    
    const relatedGroups: Array<RecommendationGroup & { 
      items: Array<RecommendationItem & { _uniqueKey: string }>;
      _groupKey: string;
    }> = [];
    let relatedTotal = 0;
    
    for (let gIdx = 0; gIdx < recommendationGroups.length; gIdx++) {
      const group = recommendationGroups[gIdx];
      const withLogos = group.items.filter(item => item.content_logo);
      const grouped = groupRecommendationItems(withLogos);
      // Use stable shuffle based on session key
      const shuffled = stableShuffleWithSeed(grouped, `${sessionKey}-rel-${gIdx}`);
      
      const uniqueItems: Array<RecommendationItem & { _uniqueKey: string }> = [];
      
      for (const item of shuffled) {
        if (uniqueItems.length >= cappedItemsPerGroup) break;
        
        const contentId = item.content_id || item.id || '';
        if (usedIds.has(contentId)) continue;
        
        usedIds.add(contentId);
        uniqueItems.push({
          ...item,
          _uniqueKey: getOrCreateStableKey(contentId, `rel${gIdx}`),
        });
      }
      
      if (uniqueItems.length > 0) {
        relatedGroups.push({
          ...group,
          items: uniqueItems,
          _groupKey: `group-${gIdx}-${group.type}`,
        });
        relatedTotal += uniqueItems.length;
      }
    }
    remaining -= relatedTotal;

    // 4. Process For You (stable order per session)
    const forYouWithLogos = forYouMix.filter(item => item.content_logo);
    const forYouGrouped = groupRecommendationItems(forYouWithLogos);
    const forYouShuffled = stableShuffleWithSeed(forYouGrouped, `${sessionKey}-fy`);
    
    const processedForYou: Array<RecommendationItem & { _uniqueKey: string }> = [];
    
    for (const item of forYouShuffled) {
      if (processedForYou.length >= Math.min(remaining * 0.5, MAX_FOR_YOU)) break;
      
      const contentId = item.content_id || item.id || '';
      if (usedIds.has(contentId)) continue;
      
      usedIds.add(contentId);
      processedForYou.push({
        ...item,
        _uniqueKey: getOrCreateStableKey(contentId, 'fy'),
      });
    }
    remaining -= processedForYou.length;

    // 5. Process Default Sections (for new users)
    const hasPersonalized = continueWatching.length > 0 || processedSeries.length > 0 || relatedGroups.length > 0;
    
    const defaultSections: Array<{ 
      title: string; 
      type: string; 
      channels: Array<Channel & { _uniqueKey: string }>;
      _sectionKey: string;
    }> = [];
    
    if (!hasPersonalized && allChannels.length > 0) {
      const validChannels = allChannels.filter(ch => ch.tvg_logo);
      
      const movies: Array<Channel & { _uniqueKey: string }> = [];
      const series: Array<Channel & { _uniqueKey: string }> = [];
      const live: Array<Channel & { _uniqueKey: string }> = [];
      const seenNames = new Set<string>();
      
      // Stable shuffle for default sections
      const shuffledChannels = stableShuffleWithSeed(validChannels, `${sessionKey}-def`);
      
      for (const ch of shuffledChannels) {
        const nameKey = ch.name.split(/S\d|E\d|\d+x\d+/i)[0].trim().toLowerCase();
        if (seenNames.has(nameKey) || usedIds.has(ch.id)) continue;
        
        seenNames.add(nameKey);
        usedIds.add(ch.id);
        
        const channelWithKey = {
          ...ch,
          _uniqueKey: getOrCreateStableKey(ch.id, 'def'),
        };
        
        const type = detectContentType(ch);
        if (type === 'movie') movies.push(channelWithKey);
        else if (type === 'series') series.push(channelWithKey);
        else live.push(channelWithKey);
        
        // Stop once we have enough
        if (movies.length >= MAX_DEFAULT_PER_SECTION && 
            series.length >= MAX_DEFAULT_PER_SECTION && 
            live.length >= MAX_DEFAULT_PER_SECTION) break;
      }
      
      if (live.length > 0) {
        defaultSections.push({
          title: '📺 TV ao Vivo',
          type: 'live',
          channels: live.slice(0, MAX_DEFAULT_PER_SECTION),
          _sectionKey: 'default-live',
        });
      }
      if (movies.length > 0) {
        defaultSections.push({
          title: '🎬 Filmes',
          type: 'movie',
          channels: movies.slice(0, MAX_DEFAULT_PER_SECTION),
          _sectionKey: 'default-movie',
        });
      }
      if (series.length > 0) {
        defaultSections.push({
          title: '📺 Séries',
          type: 'series',
          channels: series.slice(0, MAX_DEFAULT_PER_SECTION),
          _sectionKey: 'default-series',
        });
      }
    }

    // Calculate totals
    let totalCount = continueWatching.length + processedSeries.length;
    totalCount += relatedGroups.reduce((sum, g) => sum + g.items.length, 0);
    totalCount += processedForYou.length;
    totalCount += defaultSections.reduce((sum, s) => sum + s.channels.length, 0);

    return {
      continueWatching,
      seriesContinuations: processedSeries,
      relatedGroups,
      forYouMix: processedForYou,
      defaultSections,
      hasPersonalizedContent: hasPersonalized,
      totalItemCount: Math.min(totalCount, MAX_TOTAL_ITEMS),
    };
  }, [
    continueWatchingItems, 
    seriesContinuations, 
    recommendationGroups, 
    forYouMix, 
    allChannels,
    sessionKey,
  ]);

  return {
    ...processedContent,
    maxItems: MAX_TOTAL_ITEMS,
  };
}

export default usePersonalizedContent;
