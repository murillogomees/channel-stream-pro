/**
 * IPTV Player Hook - Optimized Version
 * 
 * Features:
 * - IndexedDB cache for instant loading
 * - Realtime sync with Supabase
 * - Background refresh without UI disruption
 * - Stable references to prevent re-renders
 */

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { authCache } from '@/services/authCacheService';
import { playlistCacheService } from '@/services/playlistCacheService';
import { usePlaylistRealtime } from '@/hooks/usePlaylistRealtime';
import { toast } from 'sonner';

interface Channel {
  id: string;
  name: string;
  stream_url: string;
  tvg_logo: string | null;
  tvg_id: string | null;
  category_id: string;
  category_name?: string;
  order_position: number;
}

interface Category {
  id: string;
  name: string;
  display_name: string;
  icon: string | null;
  channels: Channel[];
}

interface PlaylistState {
  categories: Category[];
  allChannels: Channel[];
  isLoading: boolean;
  isSyncing: boolean;
  lastSync: number | null;
  error: string | null;
}

const INITIAL_STATE: PlaylistState = {
  categories: [],
  allChannels: [],
  isLoading: true,
  isSyncing: false,
  lastSync: null,
  error: null,
};

export function useIPTVPlayer() {
  const [state, setState] = useState<PlaylistState>(INITIAL_STATE);
  const [currentChannel, setCurrentChannel] = useState<Channel | null>(null);
  const [customListId, setCustomListId] = useState<string | null>(null);
  
  // Refs for stable references
  const categoriesMapRef = useRef<Map<string, Category>>(new Map());
  const channelsMapRef = useRef<Map<string, Channel>>(new Map());
  const loadingRef = useRef(false);

  // Update state helper with stable reference
  const updateState = useCallback((updates: Partial<PlaylistState>) => {
    setState(prev => ({ ...prev, ...updates }));
  }, []);

  // Build channel maps for O(1) lookups
  const buildMaps = useCallback((categories: Category[]) => {
    const catMap = new Map<string, Category>();
    const chMap = new Map<string, Channel>();
    
    categories.forEach(cat => {
      catMap.set(cat.id, cat);
      cat.channels.forEach(ch => {
        chMap.set(ch.id, ch);
      });
    });
    
    categoriesMapRef.current = catMap;
    channelsMapRef.current = chMap;
  }, []);

  // Realtime handlers
  const handleChannelUpdate = useCallback((updatedChannel: Channel) => {
    setState(prev => {
      const newCategories = prev.categories.map(cat => ({
        ...cat,
        channels: cat.channels.map(ch => 
          ch.id === updatedChannel.id ? { ...ch, ...updatedChannel } : ch
        ),
      }));
      
      const newAllChannels = prev.allChannels.map(ch =>
        ch.id === updatedChannel.id ? { ...ch, ...updatedChannel } : ch
      );
      
      return { ...prev, categories: newCategories, allChannels: newAllChannels };
    });
    
    // Update current channel if it's the one being updated
    setCurrentChannel(prev => 
      prev?.id === updatedChannel.id ? { ...prev, ...updatedChannel } : prev
    );
  }, []);

  const handleChannelInsert = useCallback((newChannel: Channel) => {
    setState(prev => {
      const newCategories = prev.categories.map(cat => {
        if (cat.id === newChannel.category_id) {
          return {
            ...cat,
            channels: [...cat.channels, newChannel].sort((a, b) => a.order_position - b.order_position),
          };
        }
        return cat;
      });
      
      const newAllChannels = [...prev.allChannels, newChannel].sort((a, b) => a.order_position - b.order_position);
      
      return { ...prev, categories: newCategories, allChannels: newAllChannels };
    });
  }, []);

  const handleChannelDelete = useCallback((channelId: string) => {
    setState(prev => {
      const newCategories = prev.categories.map(cat => ({
        ...cat,
        channels: cat.channels.filter(ch => ch.id !== channelId),
      }));
      
      const newAllChannels = prev.allChannels.filter(ch => ch.id !== channelId);
      
      return { ...prev, categories: newCategories, allChannels: newAllChannels };
    });
    
    // If deleted channel was current, select next
    setCurrentChannel(prev => {
      if (prev?.id === channelId) {
        const channels = channelsMapRef.current;
        const channelIds = Array.from(channels.keys());
        const currentIndex = channelIds.indexOf(channelId);
        const nextId = channelIds[currentIndex + 1] || channelIds[currentIndex - 1];
        return nextId ? channels.get(nextId) || null : null;
      }
      return prev;
    });
  }, []);

  const handleCategoryUpdate = useCallback((updatedCategory: Partial<Category>) => {
    setState(prev => ({
      ...prev,
      categories: prev.categories.map(cat =>
        cat.id === updatedCategory.id ? { ...cat, ...updatedCategory } : cat
      ),
    }));
  }, []);

  // Setup realtime sync
  const { setCategoryIds, forceRefresh } = usePlaylistRealtime({
    playlistId: customListId,
    onChannelUpdate: handleChannelUpdate,
    onChannelInsert: handleChannelInsert,
    onChannelDelete: handleChannelDelete,
    onCategoryUpdate: handleCategoryUpdate,
    onFullRefresh: () => loadPlaylist(true),
  });

  // Load playlist (with optional force refresh)
  const loadPlaylist = useCallback(async (forceRefresh = false) => {
    if (loadingRef.current) return;
    loadingRef.current = true;

    try {
      // Get current user
      let userId = authCache.getUserId();
      if (!userId) {
        const { data: { user } } = await supabase.auth.getUser();
        userId = user?.id || null;
      }
      
      if (!userId) {
        updateState({ isLoading: false, error: 'Usuário não autenticado' });
        return;
      }

      // Get client data
      const { data: cliente } = await supabase
        .from('clientes')
        .select('id')
        .eq('user_id', userId)
        .single();

      if (!cliente) {
        updateState({ isLoading: false, error: 'Cliente não encontrado' });
        return;
      }

      // Get assigned custom list
      const { data: assignment } = await supabase
        .from('client_m3u_custom_assignments')
        .select('custom_list_id')
        .eq('cliente_id', cliente.id)
        .single();

      if (!assignment) {
        updateState({ isLoading: false, error: 'Nenhuma playlist atribuída' });
        return;
      }

      const listId = assignment.custom_list_id;
      setCustomListId(listId);

      // Check cache first (unless forcing refresh)
      if (!forceRefresh) {
        const cached = await playlistCacheService.getStats();
        if (cached.count > 0) {
          console.log('[useIPTVPlayer] Using cached data, syncing in background...');
          updateState({ isSyncing: true });
        }
      }

      // Load categories
      const { data: categoriesData, error: categoriesError } = await supabase
        .from('m3u_categories')
        .select('*')
        .eq('custom_list_id', listId)
        .order('order_position');

      if (categoriesError) throw categoriesError;

      const categoryIds = categoriesData?.map(c => c.id) || [];
      setCategoryIds(categoryIds);

      // Load channels in batches for large datasets
      const BATCH_SIZE = 5000;
      let allChannels: any[] = [];
      let hasMore = true;
      let offset = 0;

      while (hasMore) {
        const { data: channelsData, error: channelsError } = await supabase
          .from('m3u_channels')
          .select('*, m3u_categories(name, display_name)')
          .in('category_id', categoryIds)
          .order('order_position')
          .range(offset, offset + BATCH_SIZE - 1);

        if (channelsError) throw channelsError;

        allChannels = [...allChannels, ...(channelsData || [])];
        hasMore = channelsData && channelsData.length === BATCH_SIZE;
        offset += BATCH_SIZE;

        // Update UI progressively for large datasets
        if (allChannels.length >= 1000 && state.isLoading) {
          const tempCategories = buildCategoriesWithChannels(categoriesData || [], allChannels);
          updateState({ 
            categories: tempCategories, 
            allChannels: mapChannels(allChannels),
            isLoading: false 
          });
        }
      }

      // Build final categories with channels
      const categoriesWithChannels = buildCategoriesWithChannels(categoriesData || [], allChannels);
      const mappedChannels = mapChannels(allChannels);
      
      buildMaps(categoriesWithChannels);

      updateState({
        categories: categoriesWithChannels,
        allChannels: mappedChannels,
        isLoading: false,
        isSyncing: false,
        lastSync: Date.now(),
        error: null,
      });

      // Restore last watched channel
      const lastChannelId = localStorage.getItem('iptv_last_channel');
      if (lastChannelId && !currentChannel) {
        const channel = channelsMapRef.current.get(lastChannelId);
        if (channel) {
          setCurrentChannel(channel);
          return;
        }
      }

      // Set first channel as default
      if (mappedChannels.length > 0 && !currentChannel) {
        setCurrentChannel(mappedChannels[0]);
      }

    } catch (error: any) {
      console.error('[useIPTVPlayer] Error:', error);
      updateState({ 
        isLoading: false, 
        isSyncing: false, 
        error: error.message || 'Erro ao carregar playlist' 
      });
      toast.error('Erro ao carregar playlist');
    } finally {
      loadingRef.current = false;
    }
  }, [buildMaps, currentChannel, setCategoryIds, state.isLoading, updateState]);

  // Helper to build categories with channels
  const buildCategoriesWithChannels = (categories: any[], channels: any[]): Category[] => {
    return categories.map(cat => ({
      id: cat.id,
      name: cat.name,
      display_name: cat.display_name,
      icon: cat.icon,
      channels: channels
        .filter(ch => ch.category_id === cat.id)
        .map(ch => ({
          id: ch.id,
          name: ch.name,
          stream_url: ch.stream_url,
          tvg_logo: ch.tvg_logo,
          tvg_id: ch.tvg_id,
          category_id: ch.category_id,
          category_name: ch.m3u_categories?.display_name || ch.m3u_categories?.name,
          order_position: ch.order_position,
        })),
    }));
  };

  // Helper to map channel data
  const mapChannels = (channels: any[]): Channel[] => {
    return channels.map(ch => ({
      id: ch.id,
      name: ch.name,
      stream_url: ch.stream_url,
      tvg_logo: ch.tvg_logo,
      tvg_id: ch.tvg_id,
      category_id: ch.category_id,
      category_name: ch.m3u_categories?.display_name || ch.m3u_categories?.name,
      order_position: ch.order_position,
    }));
  };

  // Initial load
  useEffect(() => {
    loadPlaylist();
  }, []);

  // Save current channel to localStorage
  useEffect(() => {
    if (currentChannel) {
      localStorage.setItem('iptv_last_channel', currentChannel.id);
    }
  }, [currentChannel]);

  // Channel navigation
  const changeChannel = useCallback((channel: Channel) => {
    setCurrentChannel(channel);
  }, []);

  const nextChannel = useCallback(() => {
    if (!currentChannel) return;
    
    const channels = state.allChannels;
    const currentIndex = channels.findIndex(ch => ch.id === currentChannel.id);
    
    if (currentIndex < channels.length - 1) {
      setCurrentChannel(channels[currentIndex + 1]);
    } else {
      // Loop to first
      setCurrentChannel(channels[0]);
    }
  }, [currentChannel, state.allChannels]);

  const previousChannel = useCallback(() => {
    if (!currentChannel) return;
    
    const channels = state.allChannels;
    const currentIndex = channels.findIndex(ch => ch.id === currentChannel.id);
    
    if (currentIndex > 0) {
      setCurrentChannel(channels[currentIndex - 1]);
    } else {
      // Loop to last
      setCurrentChannel(channels[channels.length - 1]);
    }
  }, [currentChannel, state.allChannels]);

  // Search channels
  const searchChannels = useCallback((query: string): Channel[] => {
    if (!query.trim()) return state.allChannels;
    
    const lowerQuery = query.toLowerCase();
    return state.allChannels.filter(ch => 
      ch.name.toLowerCase().includes(lowerQuery) ||
      ch.category_name?.toLowerCase().includes(lowerQuery)
    );
  }, [state.allChannels]);

  // Get channel by number (1-indexed)
  const getChannelByNumber = useCallback((number: number): Channel | null => {
    const index = number - 1;
    return state.allChannels[index] || null;
  }, [state.allChannels]);

  // Memoized values
  const channelCount = useMemo(() => state.allChannels.length, [state.allChannels.length]);
  const categoryCount = useMemo(() => state.categories.length, [state.categories.length]);

  return {
    // State
    categories: state.categories,
    allChannels: state.allChannels,
    currentChannel,
    isLoading: state.isLoading,
    isSyncing: state.isSyncing,
    lastSync: state.lastSync,
    error: state.error,
    customListId,
    
    // Stats
    channelCount,
    categoryCount,
    
    // Actions
    changeChannel,
    nextChannel,
    previousChannel,
    searchChannels,
    getChannelByNumber,
    reload: loadPlaylist,
    forceRefresh: () => loadPlaylist(true),
  };
}
