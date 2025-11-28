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

// Optimized batch settings
const INITIAL_BATCH_SIZE = 2000;   // First batch for quick display
const BACKGROUND_BATCH_SIZE = 5000; // Larger batches for background loading
const PARALLEL_REQUESTS = 3;        // Number of parallel requests

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
  const allChannelsRef = useRef<any[]>([]);

  // Load available M3U lists
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

  // Group channels into categories
  const groupChannelsIntoCategories = useCallback((channels: any[]): Category[] => {
    const categoriesMap = new Map<string, Category>();

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

  // Fetch a single batch
  const fetchBatch = async (
    fileUrl: string, 
    offset: number, 
    limit: number, 
    token: string,
    signal: AbortSignal
  ): Promise<{ channels: any[]; total: number; hasMore: boolean }> => {
    const proxyUrl = 'https://sdvyxdghxqmntyoweqbd.supabase.co/functions/v1/fetch-m3u-url';
    
    const response = await fetch(proxyUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({ url: fileUrl, limit, offset }),
      signal
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Erro desconhecido' }));
      throw new Error(errorData.error || 'Erro ao buscar M3U');
    }

    return response.json();
  };

  // Load all remaining channels in parallel
  const loadAllChannels = useCallback(async (
    fileUrl: string, 
    total: number, 
    initialChannels: any[],
    token: string
  ) => {
    const controller = new AbortController();
    abortControllerRef.current = controller;
    
    // Calculate remaining batches
    const startOffset = initialChannels.length;
    const remaining = total - startOffset;
    
    if (remaining <= 0) {
      setIsLoadingMore(false);
      return;
    }

    console.log(`[IPTV Admin] Loading ${remaining} remaining channels in parallel...`);
    
    // Create batch requests
    const batches: { offset: number; limit: number }[] = [];
    for (let offset = startOffset; offset < total; offset += BACKGROUND_BATCH_SIZE) {
      batches.push({
        offset,
        limit: Math.min(BACKGROUND_BATCH_SIZE, total - offset)
      });
    }

    console.log(`[IPTV Admin] ${batches.length} batches to load`);

    // Process batches in parallel groups
    let loadedCount = initialChannels.length;
    
    for (let i = 0; i < batches.length; i += PARALLEL_REQUESTS) {
      if (controller.signal.aborted) break;
      
      const batchGroup = batches.slice(i, i + PARALLEL_REQUESTS);
      
      try {
        const results = await Promise.all(
          batchGroup.map(batch => 
            fetchBatch(fileUrl, batch.offset, batch.limit, token, controller.signal)
              .catch(err => {
                console.error(`[IPTV Admin] Batch error at offset ${batch.offset}:`, err);
                return { channels: [], total, hasMore: false };
              })
          )
        );

        // Merge results
        for (const result of results) {
          if (result.channels.length > 0) {
            allChannelsRef.current = [...allChannelsRef.current, ...result.channels];
            loadedCount += result.channels.length;
          }
        }

        // Update UI with progress
        setLoadedChannels(loadedCount);
        setLoadingProgress(`Carregando: ${loadedCount.toLocaleString()}/${total.toLocaleString()}`);
        
        // Update categories periodically (every 2 batch groups or at the end)
        if ((i % (PARALLEL_REQUESTS * 2) === 0) || (i + PARALLEL_REQUESTS >= batches.length)) {
          const updatedCategories = groupChannelsIntoCategories(allChannelsRef.current);
          setCategories(updatedCategories);
        }

      } catch (error: any) {
        if (error.name === 'AbortError') {
          console.log('[IPTV Admin] Loading cancelled');
          break;
        }
        console.error('[IPTV Admin] Batch group error:', error);
      }
    }

    if (!controller.signal.aborted) {
      // Final update
      const finalCategories = groupChannelsIntoCategories(allChannelsRef.current);
      setCategories(finalCategories);
      setLoadedChannels(allChannelsRef.current.length);
      setIsLoadingMore(false);
      setLoadingProgress('');
      
      console.log(`[IPTV Admin] Loading complete: ${allChannelsRef.current.length} channels`);
      toast.success(`${allChannelsRef.current.length.toLocaleString()} canais carregados`);
    }
  }, [groupChannelsIntoCategories]);

  // Load playlist with optimized progressive loading
  const loadPlaylist = useCallback(async (listId: string) => {
    if (isLoadingPlaylist) return;
    
    // Cancel any ongoing loading
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
      allChannelsRef.current = [];

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
      
      if (!token) throw new Error('Não autenticado');

      // Fetch first batch for quick display
      setLoadingProgress('Carregando canais...');
      
      const controller = new AbortController();
      const { channels, total, hasMore } = await fetchBatch(
        listData.file_url,
        0,
        INITIAL_BATCH_SIZE,
        token,
        controller.signal
      );
      
      setTotalChannels(total);
      setLoadedChannels(channels.length);
      allChannelsRef.current = channels;
      
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
      
      console.log(`[IPTV Admin] First batch: ${channels.length} of ${total} channels`);
      
      if (channels.length < total) {
        toast.info(`${channels.length.toLocaleString()} canais prontos, carregando mais em segundo plano...`);
        setLoadingProgress(`Carregando: ${channels.length.toLocaleString()}/${total.toLocaleString()}`);
        setIsLoadingMore(true);
        
        // Start background loading
        loadAllChannels(listData.file_url, total, channels, token);
      } else {
        toast.success(`${total.toLocaleString()} canais carregados`);
        setLoadingProgress('');
      }

    } catch (error: any) {
      console.error('[IPTV Admin] Error loading playlist:', error);
      
      let errorMsg = error.message || 'Erro ao carregar playlist';
      if (error.name === 'AbortError') {
        errorMsg = 'Carregamento cancelado';
      }
      
      toast.error(errorMsg);
      setIsLoading(false);
      setIsLoadingPlaylist(false);
      setLoadingProgress('');
    }
  }, [isLoadingPlaylist, groupChannelsIntoCategories, loadAllChannels]);

  useEffect(() => {
    loadAvailableLists();
  }, []);

  useEffect(() => {
    if (customListId && !isLoadingPlaylist) {
      loadPlaylist(customListId);
    }
    
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
