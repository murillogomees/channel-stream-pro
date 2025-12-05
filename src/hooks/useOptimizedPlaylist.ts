/**
 * useOptimizedPlaylist - Combines all playlist/channel optimizations
 * 
 * Features:
 * - Stable channel references with memoization
 * - Background refresh without UI flash
 * - Debounced search
 * - Smart content categorization
 */

import { useMemo, useCallback, useRef } from 'react';
import { useDebouncedValue } from './useDebouncedSearch';

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
}

interface UseOptimizedPlaylistOptions {
  categories: Category[];
  searchQuery: string;
  activeTab: 'home' | 'live' | 'movies' | 'series' | 'favorites';
  selectedCategoryId?: string | null;
  isFavorite?: (id: string) => boolean;
  backendResults?: Channel[];
  isBackendSearchActive?: boolean;
}

// Content classification keywords
const MOVIE_KEYWORDS = ['filme', 'movie', 'cinema', 'vod filme', 'filmes', 'movies', 'film', 'peliculas'];
const SERIES_KEYWORDS = ['série', 'series', 'seriado', 'novela', 'temporada', 'season', 'episódio', 'serie', 'séries', 'drama', 'dorama', 'anime'];

export function useOptimizedPlaylist({
  categories,
  searchQuery,
  activeTab,
  selectedCategoryId,
  isFavorite,
  backendResults = [],
  isBackendSearchActive = false,
}: UseOptimizedPlaylistOptions) {
  // Cache for expensive computations
  const cacheRef = useRef<{
    categoriesHash: string;
    categorized: { live: Category[]; movies: Category[]; series: Category[] } | null;
  }>({
    categoriesHash: '',
    categorized: null,
  });

  // Debounced search for local filtering (300ms)
  const debouncedSearch = useDebouncedValue(searchQuery, 300);

  // Generate hash of categories for change detection
  const categoriesHash = useMemo(() => {
    if (categories.length === 0) return '';
    const first = categories[0];
    const last = categories[categories.length - 1];
    return `${categories.length}-${first?.id}-${last?.id}-${first?.channels?.length || 0}`;
  }, [categories]);

  // Categorize content - only recompute when hash changes
  const categorizedContent = useMemo(() => {
    if (categoriesHash === cacheRef.current.categoriesHash && cacheRef.current.categorized) {
      return cacheRef.current.categorized;
    }

    const live: Category[] = [];
    const movies: Category[] = [];
    const series: Category[] = [];

    categories.forEach(cat => {
      const combinedText = `${cat.display_name?.toLowerCase() || ''} ${cat.name?.toLowerCase() || ''}`;
      
      const isSeries = SERIES_KEYWORDS.some(kw => combinedText.includes(kw));
      const isMovie = MOVIE_KEYWORDS.some(kw => combinedText.includes(kw)) && !isSeries;

      if (isSeries) {
        series.push(cat);
      } else if (isMovie) {
        movies.push(cat);
      } else {
        live.push(cat);
      }
    });

    const result = { live, movies, series };
    cacheRef.current.categoriesHash = categoriesHash;
    cacheRef.current.categorized = result;
    return result;
  }, [categories, categoriesHash]);

  // All channels flattened - cached
  const allChannels = useMemo(() => {
    return categories.flatMap(cat =>
      (cat.channels || []).map(ch => ({
        ...ch,
        category_name: cat.display_name || cat.name,
        category_id: cat.id,
      }))
    );
  }, [categories]);

  // Content counts
  const counts = useMemo(() => {
    // Extract unique series names
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
      live: categorizedContent.live.reduce((acc, cat) => acc + cat.channels.length, 0),
      movies: categorizedContent.movies.reduce((acc, cat) => acc + cat.channels.length, 0),
      series: uniqueSeriesNames.size,
      total: allChannels.length,
    };
  }, [categorizedContent, allChannels.length]);

  // Filtered channels based on tab and search
  const filteredChannels = useMemo(() => {
    // Backend search results take priority
    if (isBackendSearchActive && backendResults.length > 0) {
      return backendResults;
    }

    // Favorites tab
    if (activeTab === 'favorites') {
      const favs = allChannels.filter(ch => isFavorite?.(ch.id));
      if (!debouncedSearch) return favs;
      const query = debouncedSearch.toLowerCase();
      return favs.filter(ch => ch.name.toLowerCase().includes(query));
    }

    // Home tab with no search - return empty for HomeView to handle
    if (activeTab === 'home' && !isBackendSearchActive) {
      return [];
    }

    // Get source categories for tab
    let sourceCategories: Category[];
    switch (activeTab) {
      case 'live':
        sourceCategories = categorizedContent.live;
        break;
      case 'movies':
        sourceCategories = categorizedContent.movies;
        break;
      case 'series':
        sourceCategories = categorizedContent.series;
        break;
      default:
        sourceCategories = [];
    }

    // Filter by selected category
    if (selectedCategoryId) {
      sourceCategories = sourceCategories.filter(cat => cat.id === selectedCategoryId);
    }

    // Flatten channels
    let channels = sourceCategories.flatMap(cat =>
      cat.channels.map(ch => ({
        ...ch,
        category_name: cat.display_name,
      }))
    );

    // Apply local search filter
    if (debouncedSearch && debouncedSearch.length >= 2) {
      const query = debouncedSearch.toLowerCase();
      channels = channels.filter(ch => ch.name.toLowerCase().includes(query));
    }

    return channels;
  }, [
    activeTab,
    categorizedContent,
    selectedCategoryId,
    debouncedSearch,
    allChannels,
    isFavorite,
    isBackendSearchActive,
    backendResults,
  ]);

  // Categories for current tab sidebar
  const currentTabCategories = useMemo(() => {
    const getCats = () => {
      switch (activeTab) {
        case 'live':
          return categorizedContent.live;
        case 'movies':
          return categorizedContent.movies;
        case 'series':
          return categorizedContent.series;
        default:
          return [];
      }
    };

    return getCats().map(cat => ({
      id: cat.id,
      name: cat.name,
      display_name: cat.display_name,
      channelCount: cat.channels.length,
    }));
  }, [activeTab, categorizedContent]);

  // Extract series name helper
  const extractSeriesName = useCallback((name: string): string => {
    return name
      .replace(/\s*S\d{1,2}\s*E\d{1,3}.*/gi, '')
      .replace(/\s*\d{1,2}x\d{1,3}.*/gi, '')
      .replace(/\s*-?\s*Temporada\s*\d+.*/gi, '')
      .replace(/\s*Season\s*\d+.*/gi, '')
      .replace(/\s*T\d+\s*E?\d*.*/gi, '')
      .replace(/\s*Ep[is]*[óo]*d?i?o?\s*\d+.*/gi, '')
      .replace(/\s*\(\d{4}\)/g, '')
      .replace(/\s*\[.*?\]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }, []);

  // Get related episodes for a series
  const getRelatedEpisodes = useCallback((channel: Channel): Channel[] => {
    const isSeries = 
      channel.stream_url?.includes('/series/') ||
      /S\d{1,2}\s*E\d{1,3}/i.test(channel.name) ||
      /\d{1,2}x\d{1,3}/i.test(channel.name) ||
      /Temporada\s*\d+/i.test(channel.name);

    if (!isSeries) return [];

    const seriesName = extractSeriesName(channel.name);
    if (!seriesName) return [];

    const episodes = allChannels.filter(ch => {
      const chSeriesName = extractSeriesName(ch.name);
      return chSeriesName === seriesName;
    });

    // Sort by season/episode
    return episodes.sort((a, b) => {
      const matchA = a.name.match(/S(\d{1,2})[\s]*E(\d{1,3})/i) || a.name.match(/(\d{1,2})x(\d{1,3})/i);
      const matchB = b.name.match(/S(\d{1,2})[\s]*E(\d{1,3})/i) || b.name.match(/(\d{1,2})x(\d{1,3})/i);
      
      if (matchA && matchB) {
        const seasonDiff = parseInt(matchA[1]) - parseInt(matchB[1]);
        if (seasonDiff !== 0) return seasonDiff;
        return parseInt(matchA[2]) - parseInt(matchB[2]);
      }
      return a.name.localeCompare(b.name);
    });
  }, [allChannels, extractSeriesName]);

  return {
    // Categorized content
    categorizedContent,
    allChannels,
    counts,
    
    // Filtered results
    filteredChannels,
    currentTabCategories,
    
    // Helpers
    extractSeriesName,
    getRelatedEpisodes,
    
    // Debounced search state
    effectiveSearchQuery: debouncedSearch,
  };
}

export default useOptimizedPlaylist;
