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

interface AssignedPlaylist {
  id: string;
  name: string;
  cdn_url: string | null;
}

// Optimized batch settings
const INITIAL_BATCH_SIZE = 2000;
const BACKGROUND_BATCH_SIZE = 5000;
const PARALLEL_REQUESTS = 3;

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
  
  const abortControllerRef = useRef<AbortController | null>(null);
  const allChannelsRef = useRef<any[]>([]);

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

  // Fetch a single batch from M3U URL
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
    
    const startOffset = initialChannels.length;
    const remaining = total - startOffset;
    
    if (remaining <= 0) {
      setIsLoadingMore(false);
      return;
    }

    console.log(`[IPTV Client] Loading ${remaining} remaining channels...`);
    
    const batches: { offset: number; limit: number }[] = [];
    for (let offset = startOffset; offset < total; offset += BACKGROUND_BATCH_SIZE) {
      batches.push({
        offset,
        limit: Math.min(BACKGROUND_BATCH_SIZE, total - offset)
      });
    }

    let loadedCount = initialChannels.length;
    
    for (let i = 0; i < batches.length; i += PARALLEL_REQUESTS) {
      if (controller.signal.aborted) break;
      
      const batchGroup = batches.slice(i, i + PARALLEL_REQUESTS);
      
      try {
        const results = await Promise.all(
          batchGroup.map(batch => 
            fetchBatch(fileUrl, batch.offset, batch.limit, token, controller.signal)
              .catch(err => {
                console.error(`[IPTV Client] Batch error:`, err);
                return { channels: [], total, hasMore: false };
              })
          )
        );

        for (const result of results) {
          if (result.channels.length > 0) {
            allChannelsRef.current = [...allChannelsRef.current, ...result.channels];
            loadedCount += result.channels.length;
          }
        }

        setLoadedChannels(loadedCount);
        setLoadingProgress(`Carregando: ${loadedCount.toLocaleString()}/${total.toLocaleString()}`);
        
        if ((i % (PARALLEL_REQUESTS * 2) === 0) || (i + PARALLEL_REQUESTS >= batches.length)) {
          const updatedCategories = groupChannelsIntoCategories(allChannelsRef.current);
          setCategories(updatedCategories);
        }

      } catch (error: any) {
        if (error.name === 'AbortError') break;
        console.error('[IPTV Client] Batch group error:', error);
      }
    }

    if (!controller.signal.aborted) {
      const finalCategories = groupChannelsIntoCategories(allChannelsRef.current);
      setCategories(finalCategories);
      setLoadedChannels(allChannelsRef.current.length);
      setIsLoadingMore(false);
      setLoadingProgress('');
      
      console.log(`[IPTV Client] Loading complete: ${allChannelsRef.current.length} channels`);
    }
  }, [groupChannelsIntoCategories]);

  // Load playlist from CDN URL
  const loadPlaylistFromCDN = useCallback(async (cdnUrl: string) => {
    try {
      setLoadingProgress('Carregando canais...');
      
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
      
      const categoriesArray = groupChannelsIntoCategories(channels);
      setCategories(categoriesArray);
      
      if (categoriesArray.length > 0 && categoriesArray[0].channels.length > 0) {
        setCurrentChannel(categoriesArray[0].channels[0]);
      }
      
      setIsLoading(false);
      
      console.log(`[IPTV Client] First batch: ${channels.length} of ${total} channels`);
      
      if (channels.length < total) {
        setLoadingProgress(`Carregando: ${channels.length.toLocaleString()}/${total.toLocaleString()}`);
        setIsLoadingMore(true);
        loadAllChannels(cdnUrl, total, channels, token);
      } else {
        setLoadingProgress('');
      }

    } catch (error: any) {
      console.error('[IPTV Client] Error loading from CDN:', error);
      throw error;
    }
  }, [groupChannelsIntoCategories, loadAllChannels]);

  // Load channels from database (m3u_categories + m3u_channels)
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

      // Group channels by category
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

      // Set first channel as default
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

  // Main loading function - Get client's assigned playlist
  const loadClientPlaylist = useCallback(async () => {
    try {
      setIsLoading(true);
      setLoadingProgress('Verificando sua playlist...');
      setCategories([]);
      setTotalChannels(0);
      setLoadedChannels(0);
      allChannelsRef.current = [];

      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error('Usuário não autenticado');
        setIsLoading(false);
        setHasPlaylist(false);
        return;
      }

      // Get client data
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

      // Get assigned custom list
      const { data: assignment, error: assignmentError } = await supabase
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
        .single();

      if (assignmentError || !assignment) {
        console.log('[IPTV Client] No playlist assigned');
        setIsLoading(false);
        setHasPlaylist(false);
        return;
      }

      const customList = assignment.m3u_custom_lists as any;
      
      if (!customList || customList.status !== 'active') {
        console.log('[IPTV Client] Playlist not active');
        setIsLoading(false);
        setHasPlaylist(false);
        return;
      }

      setAssignedPlaylist({
        id: customList.id,
        name: customList.name,
        cdn_url: customList.cdn_url
      });
      setHasPlaylist(true);

      // Load playlist - prefer CDN URL, fallback to database
      if (customList.cdn_url) {
        console.log('[IPTV Client] Loading from CDN:', customList.cdn_url);
        await loadPlaylistFromCDN(customList.cdn_url);
      } else {
        console.log('[IPTV Client] Loading from database');
        await loadPlaylistFromDatabase(customList.id);
      }

    } catch (error: any) {
      console.error('[IPTV Client] Error loading playlist:', error);
      toast.error('Erro ao carregar playlist');
      setIsLoading(false);
      setHasPlaylist(false);
    }
  }, [loadPlaylistFromCDN, loadPlaylistFromDatabase]);

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
    changeChannel,
    nextChannel,
    previousChannel,
    reload: loadClientPlaylist
  };
}
