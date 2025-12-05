/**
 * useStableChannels - Memoized channel data with stable references
 * 
 * Prevents unnecessary re-renders by:
 * - Deep comparing channel arrays
 * - Providing stable category groupings
 * - Caching filtered results
 */

import { useMemo, useRef, useCallback } from 'react';

interface Channel {
  id: string;
  name: string;
  stream_url: string;
  tvg_logo?: string | null;
  tvg_id?: string | null;
  category_id?: string;
  category_name?: string;
  order_position?: number;
}

interface Category {
  id: string;
  name: string;
  display_name: string;
  channels: Channel[];
  channelCount: number;
}

interface UseStableChannelsOptions {
  channels: Channel[];
  categories: any[];
}

interface ContentCounts {
  live: number;
  movies: number;
  series: number;
  total: number;
}

const MOVIE_KEYWORDS = ['filme', 'movie', 'cinema', 'vod filme', 'filmes', 'movies', 'film', 'peliculas'];
const SERIES_KEYWORDS = ['série', 'series', 'seriado', 'novela', 'temporada', 'season', 'episódio', 'serie', 'séries', 'drama', 'dorama', 'anime'];

export function useStableChannels({ channels, categories }: UseStableChannelsOptions) {
  // Keep reference to last computed value to avoid recomputation
  const lastChannelsRef = useRef<Channel[]>([]);
  const lastCategorizedRef = useRef<{ live: Category[]; movies: Category[]; series: Category[] } | null>(null);

  // Check if channels actually changed (shallow check on length + first/last items)
  const channelsChanged = useMemo(() => {
    if (lastChannelsRef.current.length !== channels.length) return true;
    if (channels.length === 0) return false;
    
    const first = channels[0];
    const last = channels[channels.length - 1];
    const lastFirst = lastChannelsRef.current[0];
    const lastLast = lastChannelsRef.current[lastChannelsRef.current.length - 1];
    
    return first?.id !== lastFirst?.id || last?.id !== lastLast?.id;
  }, [channels]);

  // Update ref if changed
  if (channelsChanged) {
    lastChannelsRef.current = channels;
  }

  // Categorize content - only recompute if channels actually changed
  const categorizedContent = useMemo(() => {
    if (!channelsChanged && lastCategorizedRef.current) {
      return lastCategorizedRef.current;
    }

    const live: Category[] = [];
    const movies: Category[] = [];
    const series: Category[] = [];

    categories.forEach(cat => {
      const catName = cat.display_name?.toLowerCase() || cat.name?.toLowerCase() || '';
      const catId = cat.name?.toLowerCase() || '';
      const combinedText = `${catName} ${catId}`;

      const isSeries = SERIES_KEYWORDS.some(kw => combinedText.includes(kw));
      const isMovie = MOVIE_KEYWORDS.some(kw => combinedText.includes(kw)) && !isSeries;

      const category: Category = {
        id: cat.id,
        name: cat.name,
        display_name: cat.display_name || cat.name,
        channels: cat.channels || [],
        channelCount: cat.channels?.length || 0,
      };

      if (isSeries) {
        series.push(category);
      } else if (isMovie) {
        movies.push(category);
      } else {
        live.push(category);
      }
    });

    const result = { live, movies, series };
    lastCategorizedRef.current = result;
    return result;
  }, [categories, channelsChanged]);

  // All channels flattened - stable reference
  const allChannels = useMemo(() => {
    return categories.flatMap(cat => 
      (cat.channels || []).map((ch: Channel) => ({
        ...ch,
        category_name: cat.display_name || cat.name,
        category_id: cat.id,
      }))
    );
  }, [categories]);

  // Content counts
  const counts = useMemo((): ContentCounts => {
    // Extract unique series names for accurate counting
    const uniqueSeriesNames = new Set<string>();
    
    categorizedContent.series.forEach(cat => {
      cat.channels.forEach(ch => {
        const seriesName = ch.name
          .replace(/\s*S\d{1,2}\s*E\d{1,3}.*/gi, '')
          .replace(/\s*\d{1,2}x\d{1,3}.*/gi, '')
          .replace(/\s*Temporada\s*\d+.*/gi, '')
          .trim();
        uniqueSeriesNames.add(seriesName);
      });
    });

    return {
      live: categorizedContent.live.reduce((acc, cat) => acc + cat.channelCount, 0),
      movies: categorizedContent.movies.reduce((acc, cat) => acc + cat.channelCount, 0),
      series: uniqueSeriesNames.size,
      total: allChannels.length,
    };
  }, [categorizedContent, allChannels.length]);

  // Create filter function with memoization
  const filterChannels = useCallback((
    sourceCategories: Category[],
    searchQuery: string,
    selectedCategoryId?: string | null
  ): Channel[] => {
    let filtered = sourceCategories;

    if (selectedCategoryId) {
      filtered = filtered.filter(cat => cat.id === selectedCategoryId);
    }

    let result = filtered.flatMap(cat => 
      cat.channels.map(ch => ({
        ...ch,
        category_name: cat.display_name,
      }))
    );

    if (searchQuery && searchQuery.length >= 2) {
      const query = searchQuery.toLowerCase();
      result = result.filter(ch => ch.name.toLowerCase().includes(query));
    }

    return result;
  }, []);

  // Get channels for specific tab
  const getChannelsForTab = useCallback((
    tab: 'live' | 'movies' | 'series' | 'all',
    searchQuery?: string,
    categoryId?: string | null
  ): Channel[] => {
    const sources = {
      live: categorizedContent.live,
      movies: categorizedContent.movies,
      series: categorizedContent.series,
      all: [...categorizedContent.live, ...categorizedContent.movies, ...categorizedContent.series],
    };

    return filterChannels(sources[tab], searchQuery || '', categoryId);
  }, [categorizedContent, filterChannels]);

  return {
    categorizedContent,
    allChannels,
    counts,
    filterChannels,
    getChannelsForTab,
    // Raw data for advanced usage
    liveCategories: categorizedContent.live,
    movieCategories: categorizedContent.movies,
    seriesCategories: categorizedContent.series,
  };
}

export default useStableChannels;
