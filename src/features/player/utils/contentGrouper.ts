/**
 * Content Grouper - Groups series/episodes into single entries
 * Prevents showing multiple episodes of the same series as separate items
 */

import type { Channel, RecommendationItem } from '../types';

/**
 * Patterns to extract series name from episode title
 */
const EPISODE_PATTERNS = [
  // S01E01, S1E1, S01 E01
  /\s*S\d{1,2}\s*E\d{1,3}.*/gi,
  // 1x01, 01x01
  /\s*\d{1,2}x\d{1,3}.*/gi,
  // Temporada 1, Temp 1
  /\s*(?:Temporada|Temp\.?)\s*\d+.*/gi,
  // Season 1
  /\s*Season\s*\d+.*/gi,
  // Episode 1, Ep 1, E01
  /\s*(?:Episode|Episódio|Episodio|Ep\.?)\s*\d+.*/gi,
  // - 01, - 001
  /\s*-\s*\d{1,3}$/gi,
  // (2024), [2024]
  /\s*[\(\[]\d{4}[\)\]].*/gi,
  // | anything after pipe
  /\s*\|.*/gi,
];

/**
 * Extract the base series/content name from an episode title
 */
export function extractSeriesName(name: string): string {
  let cleanName = name.trim();
  
  for (const pattern of EPISODE_PATTERNS) {
    cleanName = cleanName.replace(pattern, '');
  }
  
  // Clean up extra spaces and trailing punctuation
  cleanName = cleanName
    .replace(/\s+/g, ' ')
    .replace(/[\s\-:]+$/g, '')
    .trim();
  
  return cleanName || name.trim();
}

/**
 * Detect if a channel is part of a series (has episode pattern)
 */
export function isSeriesEpisode(channel: Channel): boolean {
  const name = channel.name || '';
  const url = channel.stream_url?.toLowerCase() || '';
  
  // URL-based detection
  if (url.includes('/series/')) return true;
  
  // Pattern-based detection
  if (/S\d{1,2}\s*E\d{1,3}/i.test(name)) return true;
  if (/\d{1,2}x\d{1,3}/i.test(name)) return true;
  if (/(?:Temporada|Season)\s*\d+/i.test(name)) return true;
  if (/(?:Episode|Episódio|Ep\.?)\s*\d+/i.test(name)) return true;
  
  return false;
}

/**
 * Detect content type from channel
 */
export function detectContentType(channel: Channel): 'movie' | 'series' | 'live' {
  const url = channel.stream_url?.toLowerCase() || '';
  const group = (channel.group_title || channel.category_name || '').toLowerCase();
  
  const seriesKeywords = ['série', 'series', 'seriado', 'novela', 'temporada', 'season', 'episódio', 'dorama', 'anime'];
  const movieKeywords = ['filme', 'movie', 'cinema', 'vod filme', 'filmes', 'movies', 'film', 'peliculas', 'lançamento'];
  
  // URL-based detection
  if (url.includes('/series/')) return 'series';
  if (url.includes('/movie/')) return 'movie';
  if (url.includes('/live/')) return 'live';
  
  // Episode pattern in name
  if (isSeriesEpisode(channel)) return 'series';
  
  // Group/category-based
  if (seriesKeywords.some(kw => group.includes(kw)) && !movieKeywords.some(kw => group.includes(kw))) {
    return 'series';
  }
  if (movieKeywords.some(kw => group.includes(kw))) {
    return 'movie';
  }
  
  return 'live';
}

/**
 * Group channels by series name, returning only one representative per series
 * Movies and live content are passed through unchanged
 */
export function groupChannelsBySeries(channels: Channel[]): Channel[] {
  const seriesMap = new Map<string, { channel: Channel; count: number }>();
  const nonSeriesChannels: Channel[] = [];
  
  for (const channel of channels) {
    const contentType = detectContentType(channel);
    
    if (contentType === 'series') {
      const seriesName = extractSeriesName(channel.name);
      const existing = seriesMap.get(seriesName);
      
      if (!existing) {
        seriesMap.set(seriesName, { channel, count: 1 });
      } else {
        existing.count++;
        // Prefer channel with better logo
        if (!existing.channel.tvg_logo && channel.tvg_logo) {
          existing.channel = channel;
        }
      }
    } else {
      nonSeriesChannels.push(channel);
    }
  }
  
  // Combine grouped series with non-series content
  const groupedSeries = Array.from(seriesMap.values()).map(({ channel }) => channel);
  
  return [...groupedSeries, ...nonSeriesChannels];
}

/**
 * Group recommendation items by content name
 * Returns only one entry per series/content
 */
export function groupRecommendationItems(items: RecommendationItem[]): RecommendationItem[] {
  const contentMap = new Map<string, { item: RecommendationItem; count: number }>();
  
  for (const item of items) {
    const baseName = extractSeriesName(item.content_name);
    const existing = contentMap.get(baseName);
    
    if (!existing) {
      contentMap.set(baseName, { item, count: 1 });
    } else {
      existing.count++;
      // Prefer item with logo
      if (!existing.item.content_logo && item.content_logo) {
        existing.item = item;
      }
    }
  }
  
  return Array.from(contentMap.values()).map(({ item }) => item);
}

/**
 * Generic version for any content with name property
 */
export function groupByContentName<T extends { name: string; content_logo?: string }>(
  items: T[]
): T[] {
  const contentMap = new Map<string, { item: T; count: number }>();
  
  for (const item of items) {
    const baseName = extractSeriesName(item.name);
    const existing = contentMap.get(baseName);
    
    if (!existing) {
      contentMap.set(baseName, { item, count: 1 });
    } else {
      existing.count++;
      if (!existing.item.content_logo && item.content_logo) {
        existing.item = item;
      }
    }
  }
  
  return Array.from(contentMap.values()).map(({ item }) => item);
}

/**
 * Create a display name for grouped content
 */
export function getDisplayName(name: string): string {
  return extractSeriesName(name);
}
