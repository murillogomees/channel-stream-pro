import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
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

interface M3UList {
  id: string;
  name: string;
  description: string | null;
  file_url?: string;
}

const BATCH_SIZE = 300; // Load 300 channels per batch for quick initial display

export function useIPTVPlayerAdmin(selectedListId?: string) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [currentChannel, setCurrentChannel] = useState<Channel | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [customListId, setCustomListId] = useState<string | null>(selectedListId || null);
  const [availableLists, setAvailableLists] = useState<M3UList[]>([]);
  const [hasLoadedLists, setHasLoadedLists] = useState(false);
  const [isLoadingPlaylist, setIsLoadingPlaylist] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState<string>('');
  const [totalChannels, setTotalChannels] = useState(0);
  const [loadedChannels, setLoadedChannels] = useState(0);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  
  const abortControllerRef = useRef<AbortController | null>(null);
  const fileUrlRef = useRef<string | null>(null);

  // Load available M3U lists for admin selection
  const loadAvailableLists = useCallback(async () => {
    if (hasLoadedLists) return;
    
    try {
      const { data, error } = await supabase
        .from('m3u_lists')
        .select('id, name, description, file_url')
        .eq('is_default', true)
        .eq('status', 'active')
        .order('name')
        .limit(1);

      if (error) throw error;
      setAvailableLists(data || []);
      setHasLoadedLists(true);
      
      if (!selectedListId && data && data.length > 0) {
        setCustomListId(data[0].id);
      } else if (!data || data.length === 0) {
        setIsLoading(false);
        toast.error('Nenhuma playlist padrão encontrada');
      }
    } catch (error: any) {
      console.error('[IPTV Admin] Error loading lists:', error);
      toast.error('Erro ao carregar lista M3U padrão');
      setIsLoading(false);
      setHasLoadedLists(true);
    }
  }, [selectedListId, hasLoadedLists]);

  // Group channels into categories (helper function)
  const groupChannelsIntoCategories = useCallback((channels: any[], existingCategories: Category[] = []): Category[] => {
    const categoriesMap = new Map<string, Category>();
    
    // Start with existing categories
    existingCategories.forEach(cat => {
      categoriesMap.set(cat.name, { ...cat, channels: [...cat.channels] });
    });

    for (const channel of channels) {
      const categoryName = channel.category_name || 'Sem Categoria';
      
      if (!categoriesMap.has(categoryName)) {
        categoriesMap.set(categoryName, {
          id: `cat-${categoriesMap.size}`,
          name: categoryName,
          display_name: categoryName,
          icon: null,
          channels: []
        });
      }
      
      const category = categoriesMap.get(categoryName)!;
      category.channels.push({
        id: channel.id,
        name: channel.name,
        stream_url: channel.stream_url,
        tvg_logo: channel.tvg_logo,
        tvg_id: null,
        category_id: category.id,
        category_name: categoryName,
        order_position: category.channels.length
      });
    }

    return Array.from(categoriesMap.values());
  }, []);

  // Load more channels in background
  const loadMoreChannels = useCallback(async (fileUrl: string, offset: number, total: number, existingCategories: Category[]) => {
    if (offset >= total) {
      setIsLoadingMore(false);
      return;
    }

    try {
      const session = await supabase.auth.getSession();
      const token = session.data.session?.access_token;
      
      const controller = new AbortController();
      abortControllerRef.current = controller;
      
      const proxyUrl = 'https://sdvyxdghxqmntyoweqbd.supabase.co/functions/v1/fetch-m3u-url';
      
      const response = await fetch(proxyUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ 
          url: fileUrl,
          limit: BATCH_SIZE,
          offset: offset
        }),
        signal: controller.signal
      });

      if (!response.ok) {
        throw new Error('Erro ao buscar mais canais');
      }

      const { channels, hasMore } = await response.json();
      
      // Merge with existing categories
      const updatedCategories = groupChannelsIntoCategories(channels, existingCategories);
      setCategories(updatedCategories);
      setLoadedChannels(prev => prev + channels.length);
      
      const newLoaded = offset + channels.length;
      setLoadingProgress(`Carregando: ${newLoaded.toLocaleString()}/${total.toLocaleString()}`);
      
      // Continue loading more if available
      if (hasMore && !controller.signal.aborted) {
        // Small delay to not overwhelm the server
        setTimeout(() => {
          loadMoreChannels(fileUrl, offset + BATCH_SIZE, total, updatedCategories);
        }, 100);
      } else {
        setIsLoadingMore(false);
        setLoadingProgress('');
        toast.success(`${total.toLocaleString()} canais carregados`);
      }
    } catch (error: any) {
      if (error.name === 'AbortError') {
        console.log('[IPTV Admin] Background loading cancelled');
      } else {
        console.error('[IPTV Admin] Error loading more channels:', error);
      }
      setIsLoadingMore(false);
    }
  }, [groupChannelsIntoCategories]);

  // Load playlist with progressive loading
  const loadPlaylist = useCallback(async (listId: string) => {
    if (isLoadingPlaylist) return;
    
    // Cancel any ongoing background loading
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    
    try {
      setIsLoading(true);
      setIsLoadingPlaylist(true);
      setLoadingProgress('Buscando playlist...');
      setCategories([]);
      setTotalChannels(0);
      setLoadedChannels(0);

      // Get the M3U file URL
      const { data: listData, error: listError } = await supabase
        .from('m3u_lists')
        .select('file_url')
        .eq('id', listId)
        .single();

      if (listError) throw listError;
      
      fileUrlRef.current = listData.file_url;

      const session = await supabase.auth.getSession();
      const token = session.data.session?.access_token;
      
      // Fetch first batch quickly
      const proxyUrl = 'https://sdvyxdghxqmntyoweqbd.supabase.co/functions/v1/fetch-m3u-url';
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000); // 30s timeout for first batch
      
      setLoadingProgress('Carregando canais...');
      
      const response = await fetch(proxyUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ 
          url: listData.file_url,
          limit: BATCH_SIZE,
          offset: 0
        }),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Erro desconhecido' }));
        throw new Error(errorData.error || 'Erro ao buscar M3U');
      }

      const { channels, total, hasMore } = await response.json();
      
      setTotalChannels(total);
      setLoadedChannels(channels.length);
      
      // Group channels into categories
      const categoriesArray = groupChannelsIntoCategories(channels);
      setCategories(categoriesArray);
      
      // Set first channel as default
      if (categoriesArray.length > 0 && categoriesArray[0].channels.length > 0) {
        setCurrentChannel(categoriesArray[0].channels[0]);
      }
      
      // Show initial content
      setIsLoading(false);
      setIsLoadingPlaylist(false);
      
      const loadedCount = channels.length;
      console.log(`[IPTV Admin] First batch: ${loadedCount} of ${total} channels`);
      
      if (loadedCount < total) {
        toast.success(`${loadedCount.toLocaleString()} canais carregados, carregando mais...`);
        setLoadingProgress(`Carregando: ${loadedCount.toLocaleString()}/${total.toLocaleString()}`);
      } else {
        toast.success(`${total.toLocaleString()} canais carregados`);
        setLoadingProgress('');
      }
      
      // Continue loading remaining channels in background
      if (hasMore) {
        setIsLoadingMore(true);
        setTimeout(() => {
          loadMoreChannels(listData.file_url, BATCH_SIZE, total, categoriesArray);
        }, 500);
      }

    } catch (error: any) {
      console.error('[IPTV Admin] Error loading playlist:', error);
      
      let errorMsg = error.message || 'Erro ao carregar playlist';
      if (error.name === 'AbortError') {
        errorMsg = 'Timeout ao carregar. Tente novamente.';
      }
      
      toast.error(errorMsg);
      setIsLoading(false);
      setIsLoadingPlaylist(false);
      setLoadingProgress('');
    }
  }, [isLoadingPlaylist, groupChannelsIntoCategories, loadMoreChannels]);

  useEffect(() => {
    loadAvailableLists();
  }, []);

  useEffect(() => {
    if (customListId && !isLoadingPlaylist) {
      loadPlaylist(customListId);
    }
    
    // Cleanup on unmount or list change
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [customListId]);

  const changeChannel = useCallback((channel: Channel) => {
    setCurrentChannel(channel);
  }, []);

  const nextChannel = useCallback(() => {
    if (!currentChannel) return;
    
    const allChannels = categories.flatMap(cat => cat.channels);
    const currentIndex = allChannels.findIndex(ch => ch.id === currentChannel.id);
    
    if (currentIndex < allChannels.length - 1) {
      setCurrentChannel(allChannels[currentIndex + 1]);
    }
  }, [currentChannel, categories]);

  const previousChannel = useCallback(() => {
    if (!currentChannel) return;
    
    const allChannels = categories.flatMap(cat => cat.channels);
    const currentIndex = allChannels.findIndex(ch => ch.id === currentChannel.id);
    
    if (currentIndex > 0) {
      setCurrentChannel(allChannels[currentIndex - 1]);
    }
  }, [currentChannel, categories]);

  return {
    categories,
    currentChannel,
    isLoading,
    loadingProgress,
    customListId,
    availableLists,
    totalChannels,
    loadedChannels,
    isLoadingMore,
    changeChannel,
    nextChannel,
    previousChannel,
    selectList: setCustomListId,
    reload: () => customListId && loadPlaylist(customListId)
  };
}
