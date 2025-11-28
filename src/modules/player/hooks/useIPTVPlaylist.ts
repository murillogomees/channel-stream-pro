/**
 * ============================================================================
 * useIPTVPlaylist - Hook para Gerenciamento de Playlist IPTV
 * ============================================================================
 * 
 * Gerencia:
 * - Fetch de playlist M3U
 * - Categorização automática
 * - Navegação entre canais
 * - Favoritos
 * - Histórico
 * 
 * @version 1.0.0
 */

import { useState, useCallback, useMemo, useEffect } from 'react';
import { streamService, type Channel, type Category } from '../services/StreamService';

// =============================================================================
// TYPES
// =============================================================================

export interface PlaylistState {
  channels: Channel[];
  categories: Category[];
  isLoading: boolean;
  isLoadingMore: boolean;
  error: string | null;
  totalLoaded: number;
  hasMore: boolean;
}

export interface PlaylistFilters {
  search: string;
  category: string | null;
  favorites: boolean;
}

export interface UseIPTVPlaylistOptions {
  m3uUrl: string | null;
  autoLoad?: boolean;
  pageSize?: number;
  onChannelSelect?: (channel: Channel) => void;
}

// =============================================================================
// LOCAL STORAGE KEYS
// =============================================================================

const FAVORITES_KEY = 'iptv_favorites';
const HISTORY_KEY = 'iptv_history';
const LAST_CHANNEL_KEY = 'iptv_last_channel';

// =============================================================================
// HOOK
// =============================================================================

export function useIPTVPlaylist(options: UseIPTVPlaylistOptions) {
  const {
    m3uUrl,
    autoLoad = true,
    pageSize = 300,
    onChannelSelect,
  } = options;

  // ---------------------------------------------------------------------------
  // State
  // ---------------------------------------------------------------------------

  const [state, setState] = useState<PlaylistState>({
    channels: [],
    categories: [],
    isLoading: false,
    isLoadingMore: false,
    error: null,
    totalLoaded: 0,
    hasMore: true,
  });

  const [filters, setFilters] = useState<PlaylistFilters>({
    search: '',
    category: null,
    favorites: false,
  });

  const [favorites, setFavorites] = useState<Set<string>>(() => {
    try {
      const stored = localStorage.getItem(FAVORITES_KEY);
      return stored ? new Set(JSON.parse(stored)) : new Set();
    } catch {
      return new Set();
    }
  });

  const [history, setHistory] = useState<string[]>(() => {
    try {
      const stored = localStorage.getItem(HISTORY_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  const [currentChannelIndex, setCurrentChannelIndex] = useState<number>(-1);

  // ---------------------------------------------------------------------------
  // Persist favorites and history
  // ---------------------------------------------------------------------------

  useEffect(() => {
    localStorage.setItem(FAVORITES_KEY, JSON.stringify([...favorites]));
  }, [favorites]);

  useEffect(() => {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history.slice(0, 50)));
  }, [history]);

  // ---------------------------------------------------------------------------
  // Load Playlist
  // ---------------------------------------------------------------------------

  const loadPlaylist = useCallback(async (reset = true) => {
    if (!m3uUrl) return;

    setState(prev => ({
      ...prev,
      isLoading: reset,
      isLoadingMore: !reset,
      error: null,
    }));

    try {
      const offset = reset ? 0 : state.totalLoaded;
      const result = await streamService.fetchM3U(m3uUrl, { limit: pageSize, offset });

      const newChannels = reset 
        ? result.channels 
        : [...state.channels, ...result.channels];

      const categories = streamService.groupByCategory(newChannels);

      setState(prev => ({
        ...prev,
        channels: newChannels,
        categories,
        isLoading: false,
        isLoadingMore: false,
        totalLoaded: newChannels.length,
        hasMore: result.hasMore,
      }));
    } catch (error) {
      console.error('[useIPTVPlaylist] Load error:', error);
      setState(prev => ({
        ...prev,
        isLoading: false,
        isLoadingMore: false,
        error: error instanceof Error ? error.message : 'Erro desconhecido',
      }));
    }
  }, [m3uUrl, pageSize, state.channels, state.totalLoaded]);

  const loadMore = useCallback(() => {
    if (!state.isLoadingMore && state.hasMore) {
      loadPlaylist(false);
    }
  }, [loadPlaylist, state.isLoadingMore, state.hasMore]);

  // Auto-load on mount
  useEffect(() => {
    if (autoLoad && m3uUrl) {
      loadPlaylist(true);
    }
  }, [m3uUrl, autoLoad]); // eslint-disable-line react-hooks/exhaustive-deps

  // ---------------------------------------------------------------------------
  // Filtered Channels
  // ---------------------------------------------------------------------------

  const filteredChannels = useMemo(() => {
    let result = state.channels;

    // Filter by favorites
    if (filters.favorites) {
      result = result.filter(ch => favorites.has(ch.id));
    }

    // Filter by category
    if (filters.category) {
      result = result.filter(ch => ch.category_name === filters.category);
    }

    // Filter by search
    if (filters.search.trim()) {
      const search = filters.search.toLowerCase();
      result = result.filter(ch => 
        ch.name.toLowerCase().includes(search) ||
        ch.category_name?.toLowerCase().includes(search)
      );
    }

    return result;
  }, [state.channels, filters, favorites]);

  const filteredCategories = useMemo(() => {
    return streamService.groupByCategory(filteredChannels);
  }, [filteredChannels]);

  // ---------------------------------------------------------------------------
  // Channel Navigation
  // ---------------------------------------------------------------------------

  const selectChannel = useCallback((channel: Channel) => {
    const index = filteredChannels.findIndex(ch => ch.id === channel.id);
    setCurrentChannelIndex(index);

    // Add to history
    setHistory(prev => {
      const filtered = prev.filter(id => id !== channel.id);
      return [channel.id, ...filtered].slice(0, 50);
    });

    // Save last channel
    localStorage.setItem(LAST_CHANNEL_KEY, channel.id);

    onChannelSelect?.(channel);
  }, [filteredChannels, onChannelSelect]);

  const currentChannel = useMemo(() => {
    if (currentChannelIndex >= 0 && currentChannelIndex < filteredChannels.length) {
      return filteredChannels[currentChannelIndex];
    }
    return null;
  }, [filteredChannels, currentChannelIndex]);

  const nextChannel = useCallback(() => {
    if (filteredChannels.length === 0) return;

    const newIndex = currentChannelIndex < filteredChannels.length - 1 
      ? currentChannelIndex + 1 
      : 0;
    
    selectChannel(filteredChannels[newIndex]);
  }, [currentChannelIndex, filteredChannels, selectChannel]);

  const previousChannel = useCallback(() => {
    if (filteredChannels.length === 0) return;

    const newIndex = currentChannelIndex > 0 
      ? currentChannelIndex - 1 
      : filteredChannels.length - 1;
    
    selectChannel(filteredChannels[newIndex]);
  }, [currentChannelIndex, filteredChannels, selectChannel]);

  const selectChannelByNumber = useCallback((num: number) => {
    if (num >= 0 && num < filteredChannels.length) {
      selectChannel(filteredChannels[num]);
    }
  }, [filteredChannels, selectChannel]);

  // ---------------------------------------------------------------------------
  // Favorites
  // ---------------------------------------------------------------------------

  const toggleFavorite = useCallback((channelId: string) => {
    setFavorites(prev => {
      const next = new Set(prev);
      if (next.has(channelId)) {
        next.delete(channelId);
      } else {
        next.add(channelId);
      }
      return next;
    });
  }, []);

  const isFavorite = useCallback((channelId: string) => {
    return favorites.has(channelId);
  }, [favorites]);

  // ---------------------------------------------------------------------------
  // Filters
  // ---------------------------------------------------------------------------

  const setSearch = useCallback((search: string) => {
    setFilters(prev => ({ ...prev, search }));
  }, []);

  const setCategory = useCallback((category: string | null) => {
    setFilters(prev => ({ ...prev, category }));
  }, []);

  const setFavoritesFilter = useCallback((enabled: boolean) => {
    setFilters(prev => ({ ...prev, favorites: enabled }));
  }, []);

  const clearFilters = useCallback(() => {
    setFilters({ search: '', category: null, favorites: false });
  }, []);

  // ---------------------------------------------------------------------------
  // Restore last channel
  // ---------------------------------------------------------------------------

  const restoreLastChannel = useCallback(() => {
    const lastId = localStorage.getItem(LAST_CHANNEL_KEY);
    if (lastId) {
      const channel = state.channels.find(ch => ch.id === lastId);
      if (channel) {
        selectChannel(channel);
        return channel;
      }
    }
    return null;
  }, [state.channels, selectChannel]);

  // ---------------------------------------------------------------------------
  // Return
  // ---------------------------------------------------------------------------

  return {
    // State
    channels: filteredChannels,
    categories: filteredCategories,
    allCategories: state.categories,
    isLoading: state.isLoading,
    isLoadingMore: state.isLoadingMore,
    error: state.error,
    hasMore: state.hasMore,
    totalChannels: state.channels.length,
    
    // Current
    currentChannel,
    currentIndex: currentChannelIndex,
    
    // Actions
    loadPlaylist: () => loadPlaylist(true),
    loadMore,
    selectChannel,
    nextChannel,
    previousChannel,
    selectChannelByNumber,
    
    // Favorites
    favorites,
    toggleFavorite,
    isFavorite,
    
    // Filters
    filters,
    setSearch,
    setCategory,
    setFavoritesFilter,
    clearFilters,
    
    // History
    history,
    restoreLastChannel,
    
    // Helpers
    getPlayableUrl: (channel: Channel) => streamService.getPlayableUrl(channel),
  };
}

export default useIPTVPlaylist;
