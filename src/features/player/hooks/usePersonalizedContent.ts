/**
 * usePersonalizedContent - Optimized hook for personalized home content
 * 
 * Features:
 * - Maximum 500 items total
 * - Priority: Continue Watching > Related > AI Suggestions
 * - Behavior-based recommendations
 * - Stable hook order (no conditional hooks)
 */

import { useMemo, useRef } from 'react';
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

// Generate unique key for items
function generateUniqueKey(item: any, prefix: string, index: number, usedKeys: Set<string>): string {
  const baseId = item.id || item.content_id || item.channel_id || `idx${index}`;
  let key = `${prefix}-${baseId}`;
  
  let counter = 0;
  while (usedKeys.has(key)) {
    counter++;
    key = `${prefix}-${baseId}-${counter}`;
  }
  
  usedKeys.add(key);
  return key;
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

  // Use ref for session key to avoid recreating data on each render
  const sessionRef = useRef(sessionKey);
  const shuffledDataRef = useRef<{
    key: string;
    continueWatching: WatchProgress[];
    seriesContinuations: typeof seriesContinuations;
    relatedGroups: RecommendationGroup[];
    forYouMix: RecommendationItem[];
    defaultSections: Array<{ title: string; type: string; channels: Channel[] }>;
  } | null>(null);

  // Process all content in a single useMemo to maintain stable hook order
  const processedContent = useMemo(() => {
    const usedKeys = new Set<string>();
    const usedContentIds = new Set<string>();
    
    // Calculate budget
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
      const contentId = item.content_id || item.id;
      if (!usedContentIds.has(contentId) && continueWatching.length < MAX_CONTINUE_WATCHING) {
        usedContentIds.add(contentId);
        continueWatching.push({
          ...item,
          _uniqueKey: generateUniqueKey(item, 'cw', continueWatching.length, usedKeys),
        });
      }
    }
    remaining -= continueWatching.length;

    // 2. Process Series Continuations
    const processedSeries: Array<typeof seriesContinuations[0] & { _uniqueKey: string }> = [];
    const seenSeries = new Set<string>();
    
    for (const item of seriesContinuations) {
      if (processedSeries.length >= 10) break;
      
      const seriesKey = item.seriesName.toLowerCase().trim();
      const channelId = item.nextEpisode?.id || '';
      
      if (!seenSeries.has(seriesKey) && !usedContentIds.has(channelId)) {
        if (item.logo || item.nextEpisode?.tvg_logo) {
          seenSeries.add(seriesKey);
          usedContentIds.add(channelId);
          processedSeries.push({
            ...item,
            _uniqueKey: generateUniqueKey({ id: channelId }, 'sc', processedSeries.length, usedKeys),
          });
        }
      }
    }
    remaining -= processedSeries.length;

    // 3. Process Related Groups
    const totalRelatedBudget = Math.min(remaining * 0.5, 200);
    const itemsPerGroup = Math.floor(totalRelatedBudget / Math.max(1, recommendationGroups.length));
    const cappedItemsPerGroup = Math.min(itemsPerGroup, MAX_RELATED_PER_CATEGORY);
    
    const relatedGroups: Array<RecommendationGroup & { items: Array<RecommendationItem & { _uniqueKey: string }> }> = [];
    let relatedTotal = 0;
    
    for (let gIdx = 0; gIdx < recommendationGroups.length; gIdx++) {
      const group = recommendationGroups[gIdx];
      const withLogos = group.items.filter(item => item.content_logo);
      const grouped = groupRecommendationItems(withLogos);
      const shuffled = shuffleArray(grouped);
      
      const uniqueItems: Array<RecommendationItem & { _uniqueKey: string }> = [];
      
      for (const item of shuffled) {
        if (uniqueItems.length >= cappedItemsPerGroup) break;
        
        const contentId = item.content_id || item.id || '';
        if (!usedContentIds.has(contentId)) {
          usedContentIds.add(contentId);
          uniqueItems.push({
            ...item,
            _uniqueKey: generateUniqueKey(item, `rel${gIdx}`, uniqueItems.length, usedKeys),
          });
        }
      }
      
      if (uniqueItems.length > 0) {
        relatedGroups.push({
          ...group,
          items: uniqueItems,
        });
        relatedTotal += uniqueItems.length;
      }
    }
    remaining -= relatedTotal;

    // 4. Process For You
    const forYouWithLogos = forYouMix.filter(item => item.content_logo);
    const forYouGrouped = groupRecommendationItems(forYouWithLogos);
    const forYouShuffled = shuffleArray(forYouGrouped);
    
    const processedForYou: Array<RecommendationItem & { _uniqueKey: string }> = [];
    
    for (const item of forYouShuffled) {
      if (processedForYou.length >= Math.min(remaining * 0.5, MAX_FOR_YOU)) break;
      
      const contentId = item.content_id || item.id || '';
      if (!usedContentIds.has(contentId)) {
        usedContentIds.add(contentId);
        processedForYou.push({
          ...item,
          _uniqueKey: generateUniqueKey(item, 'fy', processedForYou.length, usedKeys),
        });
      }
    }
    remaining -= processedForYou.length;

    // 5. Process Default Sections (only if no personalized content)
    const hasPersonalized = continueWatching.length > 0 || processedSeries.length > 0 || relatedGroups.length > 0;
    
    const defaultSections: Array<{ 
      title: string; 
      type: string; 
      channels: Array<Channel & { _uniqueKey: string }> 
    }> = [];
    
    if (!hasPersonalized && allChannels.length > 0) {
      const validChannels = allChannels.filter(ch => ch.tvg_logo);
      
      const movies: Array<Channel & { _uniqueKey: string }> = [];
      const series: Array<Channel & { _uniqueKey: string }> = [];
      const live: Array<Channel & { _uniqueKey: string }> = [];
      const seenNames = new Set<string>();
      
      for (const ch of validChannels) {
        const nameKey = ch.name.split(/S\d|E\d|\d+x\d+/i)[0].trim().toLowerCase();
        if (seenNames.has(nameKey) || usedContentIds.has(ch.id)) continue;
        
        seenNames.add(nameKey);
        usedContentIds.add(ch.id);
        
        const channelWithKey = {
          ...ch,
          _uniqueKey: generateUniqueKey(ch, 'def', seenNames.size, usedKeys),
        };
        
        const type = detectContentType(ch);
        if (type === 'movie') movies.push(channelWithKey);
        else if (type === 'series') series.push(channelWithKey);
        else live.push(channelWithKey);
      }
      
      const perSection = Math.floor(remaining / 3);
      const limit = Math.min(perSection, MAX_DEFAULT_PER_SECTION);
      
      if (live.length > 0) {
        defaultSections.push({
          title: '📺 TV ao Vivo',
          type: 'live',
          channels: shuffleArray(live).slice(0, limit),
        });
      }
      if (movies.length > 0) {
        defaultSections.push({
          title: '🎬 Filmes',
          type: 'movie',
          channels: shuffleArray(movies).slice(0, limit),
        });
      }
      if (series.length > 0) {
        defaultSections.push({
          title: '📺 Séries',
          type: 'series',
          channels: shuffleArray(series).slice(0, limit),
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
