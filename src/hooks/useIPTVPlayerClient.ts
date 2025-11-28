import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { playlistCacheService } from '@/services/playlistCacheService';

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

interface AssignedPlaylist {
  id: string;
  name: string;
  cdn_url: string | null;
}

// Optimized batch settings
const INITIAL_BATCH_SIZE = 2000;
const BACKGROUND_BATCH_SIZE = 5000;
const PARALLEL_BATCHES = 3; // Load 3 batches in parallel
const MAX_RETRIES = 3;
const CACHE_SAVE_INTERVAL = 10000; // Save to cache every 10k channels

export function useIPTVPlayerClient() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [currentChannel, setCurrentChannel] = useState<Channel | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [assignedPlaylist, setAssignedPlaylist] = useState<AssignedPlaylist | null>(null);
  const [loadingProgress, setLoadingProgress] = useState<string>('');
  const [totalChannels, setTotalChannels] = useState(0);
  const [loadedChannels, setLoadedChannels] = useState(0);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasPlaylist, setHasPlaylist] = useState<boolean | null>(null);
  const [isCached, setIsCached] = useState(false);
  
  const abortControllerRef = useRef<AbortController | null>(null);
  const allChannelsRef = useRef<any[]>([]);
  const lastCacheSaveRef = useRef<number>(0);

  // Group channels into categories
  const groupChannelsIntoCategories = useCallback((channels: any[]): Category[] => {
    const categoriesMap = new Map<string, Category>();

    for (const channel of channels) {
      const categoryName = channel.category_name || channel.group_title || 'Sem Categoria';
      
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
        tvg_id: channel.tvg_id || null,
        category_id: category.id,
        category_name: categoryName,
        order_position: category.channels.length
      });
    }

    return Array.from(categoriesMap.values());
  }, []);

  // Delay helper
  const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

  // Fetch a single batch from M3U URL
  const fetchBatch = async (
    fileUrl: string, 
    offset: number, 
    limit: number, 
    token: string,
    signal: AbortSignal
  ): Promise<{ channels: any[]; total: number; hasMore: boolean }> => {
    const proxyUrl = 'https://sdvyxdghxqmntyoweqbd.supabase.co/functions/v1/fetch-m3u-url';
    
    let lastError: Error | null = null;
    
    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      try {
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
          throw new Error(`HTTP ${response.status}`);
        }

        const data = await response.json();
        
        // If server says retry, wait and continue
        if (data.partial && data.retryAfter && data.channels.length === 0) {
          console.log(`[IPTV Client] Server building cache, attempt ${attempt + 1}/${MAX_RETRIES}`);
          await delay(data.retryAfter * 1000);
          continue;
        }

        return {
          channels: data.channels || [],
          total: data.total || 0,
          hasMore: data.hasMore ?? false
        };
      } catch (error: any) {
        if (error.name === 'AbortError') throw error;
        lastError = error;
        console.error(`[IPTV Client] Fetch attempt ${attempt + 1} failed:`, error);
        await delay(2000 * (attempt + 1));
      }
    }

    throw lastError || new Error('Failed to fetch batch');
  };

  // Load channels in parallel batches
  const loadAllChannelsParallel = useCallback(async (
    fileUrl: string, 
    total: number, 
    initialChannels: any[],
    token: string
  ) => {
    const controller = new AbortController();
    abortControllerRef.current = controller;
    
    let currentOffset = initialChannels.length;
    let loadedCount = initialChannels.length;
    
    console.log(`[IPTV Client] Loading ${total - currentOffset} remaining channels in parallel batches...`);
    
    while (currentOffset < total && !controller.signal.aborted) {
      // Prepare parallel batch requests
      const batchPromises: Promise<{ channels: any[]; offset: number }>[] = [];
      
      for (let i = 0; i < PARALLEL_BATCHES && currentOffset + (i * BACKGROUND_BATCH_SIZE) < total; i++) {
        const batchOffset = currentOffset + (i * BACKGROUND_BATCH_SIZE);
        const batchLimit = Math.min(BACKGROUND_BATCH_SIZE, total - batchOffset);
        
        batchPromises.push(
          fetchBatch(fileUrl, batchOffset, batchLimit, token, controller.signal)
            .then(result => ({ channels: result.channels, offset: batchOffset }))
            .catch(error => {
              console.error(`[IPTV Client] Batch at offset ${batchOffset} failed:`, error);
              return { channels: [], offset: batchOffset };
            })
        );
      }

      if (batchPromises.length === 0) break;

      try {
        // Wait for all parallel batches
        const results = await Promise.all(batchPromises);
        
        // Sort by offset and merge
        results.sort((a, b) => a.offset - b.offset);
        
        let newChannelsCount = 0;
        for (const result of results) {
          if (result.channels.length > 0) {
            allChannelsRef.current = [...allChannelsRef.current, ...result.channels];
            newChannelsCount += result.channels.length;
          }
        }

        if (newChannelsCount === 0) {
          // No new channels from any batch, we might be done
          console.log('[IPTV Client] No new channels received, stopping');
          break;
        }

        loadedCount = allChannelsRef.current.length;
        currentOffset += PARALLEL_BATCHES * BACKGROUND_BATCH_SIZE;
        
        setLoadedChannels(loadedCount);
        setLoadingProgress(`Carregando: ${loadedCount.toLocaleString()}/${total.toLocaleString()}`);
        
        // Update UI
        const updatedCategories = groupChannelsIntoCategories(allChannelsRef.current);
        setCategories(updatedCategories);

        // Save to cache periodically
        if (loadedCount - lastCacheSaveRef.current >= CACHE_SAVE_INTERVAL) {
          playlistCacheService.save(fileUrl, allChannelsRef.current, total);
          lastCacheSaveRef.current = loadedCount;
        }

      } catch (error: any) {
        if (error.name === 'AbortError') break;
        console.error('[IPTV Client] Parallel batch error:', error);
        await delay(3000);
      }
    }

    // Final save to cache
    if (!controller.signal.aborted && allChannelsRef.current.length > 0) {
      await playlistCacheService.save(fileUrl, allChannelsRef.current, total);
      
      const finalCategories = groupChannelsIntoCategories(allChannelsRef.current);
      setCategories(finalCategories);
      setLoadedChannels(allChannelsRef.current.length);
      setIsLoadingMore(false);
      setLoadingProgress('');
      
      console.log(`[IPTV Client] Loading complete: ${allChannelsRef.current.length} channels (saved to cache)`);
    }
  }, [groupChannelsIntoCategories]);

  // Load playlist - check cache first
  const loadPlaylistFromCDN = useCallback(async (cdnUrl: string) => {
    try {
      setLoadingProgress('Verificando cache local...');
      
      // Check local cache first
      const cachedPlaylist = await playlistCacheService.getByUrl(cdnUrl);
      
      if (cachedPlaylist && cachedPlaylist.channels.length > 0) {
        console.log(`[IPTV Client] Using cached playlist: ${cachedPlaylist.channels.length} channels`);
        
        allChannelsRef.current = cachedPlaylist.channels;
        setTotalChannels(cachedPlaylist.totalChannels);
        setLoadedChannels(cachedPlaylist.channels.length);
        setIsCached(true);
        
        const categoriesArray = groupChannelsIntoCategories(cachedPlaylist.channels);
        setCategories(categoriesArray);
        
        if (categoriesArray.length > 0 && categoriesArray[0].channels.length > 0) {
          setCurrentChannel(categoriesArray[0].channels[0]);
        }
        
        setIsLoading(false);
        setLoadingProgress('');
        
        // If cache is incomplete, continue loading in background
        if (cachedPlaylist.channels.length < cachedPlaylist.totalChannels) {
          setIsLoadingMore(true);
          const session = await supabase.auth.getSession();
          const token = session.data.session?.access_token;
          if (token) {
            loadAllChannelsParallel(cdnUrl, cachedPlaylist.totalChannels, cachedPlaylist.channels, token);
          }
        }
        
        return;
      }
      
      // No cache, fetch from server
      setLoadingProgress('Carregando canais...');
      setIsCached(false);
      
      const session = await supabase.auth.getSession();
      const token = session.data.session?.access_token;
      
      if (!token) throw new Error('Não autenticado');

      const controller = new AbortController();
      const { channels, total, hasMore } = await fetchBatch(
        cdnUrl,
        0,
        INITIAL_BATCH_SIZE,
        token,
        controller.signal
      );
      
      setTotalChannels(total);
      setLoadedChannels(channels.length);
      allChannelsRef.current = channels;
      lastCacheSaveRef.current = 0;
      
      const categoriesArray = groupChannelsIntoCategories(channels);
      setCategories(categoriesArray);
      
      if (categoriesArray.length > 0 && categoriesArray[0].channels.length > 0) {
        setCurrentChannel(categoriesArray[0].channels[0]);
      }
      
      setIsLoading(false);
      
      console.log(`[IPTV Client] First batch: ${channels.length} of ${total} channels`);
      
      // Save initial batch to cache
      await playlistCacheService.save(cdnUrl, channels, total);
      
      if (channels.length < total) {
        setLoadingProgress(`Carregando: ${channels.length.toLocaleString()}/${total.toLocaleString()}`);
        setIsLoadingMore(true);
        loadAllChannelsParallel(cdnUrl, total, channels, token);
      } else {
        setLoadingProgress('');
      }

    } catch (error: any) {
      console.error('[IPTV Client] Error loading from CDN:', error);
      throw error;
    }
  }, [groupChannelsIntoCategories, loadAllChannelsParallel]);

  // Load channels from database
  const loadPlaylistFromDatabase = useCallback(async (customListId: string) => {
    try {
      setLoadingProgress('Carregando categorias...');

      const { data: categoriesData, error: categoriesError } = await supabase
        .from('m3u_categories')
        .select('*')
        .eq('custom_list_id', customListId)
        .order('order_position');

      if (categoriesError) throw categoriesError;

      if (!categoriesData || categoriesData.length === 0) {
        setCategories([]);
        setIsLoading(false);
        return;
      }

      setLoadingProgress('Carregando canais...');

      const { data: channelsData, error: channelsError } = await supabase
        .from('m3u_channels')
        .select('*, m3u_categories(name, display_name)')
        .in('category_id', categoriesData.map(c => c.id))
        .order('order_position');

      if (channelsError) throw channelsError;

      const categoriesWithChannels: Category[] = categoriesData.map(cat => ({
        id: cat.id,
        name: cat.name,
        display_name: cat.display_name,
        icon: cat.icon,
        channels: (channelsData || [])
          .filter(ch => ch.category_id === cat.id)
          .map(ch => ({
            id: ch.id,
            name: ch.name,
            stream_url: ch.stream_url,
            tvg_logo: ch.tvg_logo,
            tvg_id: ch.tvg_id,
            category_id: ch.category_id,
            category_name: (ch.m3u_categories as any)?.display_name || (ch.m3u_categories as any)?.name,
            order_position: ch.order_position || 0
          }))
      }));

      setCategories(categoriesWithChannels);
      setTotalChannels(channelsData?.length || 0);
      setLoadedChannels(channelsData?.length || 0);

      if (categoriesWithChannels.length > 0 && categoriesWithChannels[0].channels.length > 0) {
        setCurrentChannel(categoriesWithChannels[0].channels[0]);
      }

      setIsLoading(false);
      setLoadingProgress('');

    } catch (error: any) {
      console.error('[IPTV Client] Error loading from database:', error);
      throw error;
    }
  }, []);

  // Main loading function
  const loadClientPlaylist = useCallback(async () => {
    try {
      setIsLoading(true);
      setLoadingProgress('Verificando sua playlist...');
      setCategories([]);
      setTotalChannels(0);
      setLoadedChannels(0);
      allChannelsRef.current = [];

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error('Usuário não autenticado');
        setIsLoading(false);
        setHasPlaylist(false);
        return;
      }

      const { data: cliente, error: clienteError } = await supabase
        .from('clientes')
        .select('id')
        .eq('user_id', user.id)
        .single();

      if (clienteError || !cliente) {
        console.error('[IPTV Client] Client not found:', clienteError);
        setIsLoading(false);
        setHasPlaylist(false);
        return;
      }

      // Try custom list first
      const { data: customAssignment } = await supabase
        .from('client_m3u_custom_assignments')
        .select(`
          custom_list_id,
          m3u_custom_lists (
            id,
            name,
            cdn_url,
            status
          )
        `)
        .eq('cliente_id', cliente.id)
        .maybeSingle();

      if (customAssignment?.m3u_custom_lists) {
        const customList = customAssignment.m3u_custom_lists as any;
        
        if (customList.status === 'active') {
          setAssignedPlaylist({
            id: customList.id,
            name: customList.name,
            cdn_url: customList.cdn_url
          });
          setHasPlaylist(true);

          if (customList.cdn_url) {
            console.log('[IPTV Client] Loading from CDN:', customList.cdn_url);
            await loadPlaylistFromCDN(customList.cdn_url);
          } else {
            console.log('[IPTV Client] Loading from database');
            await loadPlaylistFromDatabase(customList.id);
          }
          return;
        }
      }

      // Fallback: traditional M3U list
      const { data: traditionalAssignment } = await supabase
        .from('client_m3u_lists')
        .select(`
          m3u_list_id,
          is_active,
          m3u_lists (
            id,
            name,
            file_url,
            status
          )
        `)
        .eq('client_id', cliente.id)
        .eq('is_active', true)
        .limit(1)
        .maybeSingle();

      if (traditionalAssignment?.m3u_lists) {
        const m3uList = traditionalAssignment.m3u_lists as any;
        
        if (m3uList.status === 'active' && m3uList.file_url) {
          setAssignedPlaylist({
            id: m3uList.id,
            name: m3uList.name,
            cdn_url: m3uList.file_url
          });
          setHasPlaylist(true);

          console.log('[IPTV Client] Loading from traditional M3U list:', m3uList.name);
          await loadPlaylistFromCDN(m3uList.file_url);
          return;
        }
      }

      console.log('[IPTV Client] No playlist assigned');
      setIsLoading(false);
      setHasPlaylist(false);

    } catch (error: any) {
      console.error('[IPTV Client] Error loading playlist:', error);
      toast.error('Erro ao carregar playlist');
      setIsLoading(false);
      setHasPlaylist(false);
    }
  }, [loadPlaylistFromCDN, loadPlaylistFromDatabase]);

  // Clear cache and reload
  const clearCacheAndReload = useCallback(async () => {
    await playlistCacheService.clearAll();
    setIsCached(false);
    loadClientPlaylist();
  }, [loadClientPlaylist]);

  // Initial load
  useEffect(() => {
    loadClientPlaylist();
    
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

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
    assignedPlaylist,
    hasPlaylist,
    totalChannels,
    loadedChannels,
    isLoadingMore,
    isCached,
    changeChannel,
    nextChannel,
    previousChannel,
    refreshPlaylist: loadClientPlaylist,
    clearCacheAndReload,
  };
}
