import { useState, useEffect, useCallback } from 'react';
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

export function useIPTVPlayerAdmin(selectedListId?: string) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [currentChannel, setCurrentChannel] = useState<Channel | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [customListId, setCustomListId] = useState<string | null>(selectedListId || null);
  const [availableLists, setAvailableLists] = useState<M3UList[]>([]);

  // Load available M3U lists for admin selection - using default playlist from m3u_lists
  const loadAvailableLists = useCallback(async () => {
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
      
      // Auto-select default list if found
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
    }
  }, [selectedListId]);

  // Load playlist from default M3U list
  const loadPlaylist = useCallback(async (listId: string) => {
    try {
      setIsLoading(true);
      setCustomListId(listId);

      // Get the M3U file URL
      const { data: listData, error: listError } = await supabase
        .from('m3u_lists')
        .select('file_url')
        .eq('id', listId)
        .single();

      if (listError) {
        throw listError;
      }

      // Fetch and parse M3U file using proxy with timeout
      const proxyUrl = 'https://sdvyxdghxqmntyoweqbd.supabase.co/functions/v1/fetch-m3u-url';
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 35000);
      
      try {
        const proxyResponse = await fetch(proxyUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
          },
          body: JSON.stringify({ 
            url: listData.file_url,
            limit: 5000,
            offset: 0
          }),
          signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (!proxyResponse.ok) {
          const errorData = await proxyResponse.json().catch(() => ({ error: 'Erro desconhecido' }));
          throw new Error(errorData.error || 'Erro ao buscar M3U');
        }

        const { channels, total } = await proxyResponse.json();
        
        if (total && total > 5000) {
          toast.info(`Carregados primeiros 5.000 de ${total.toLocaleString()} canais`);
        }
        
        // Group channels by category
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

        const categoriesArray = Array.from(categoriesMap.values());
        setCategories(categoriesArray);

        // Set first channel as default
        if (categoriesArray.length > 0 && categoriesArray[0].channels.length > 0) {
          setCurrentChannel(categoriesArray[0].channels[0]);
        }
      } catch (error: any) {
        clearTimeout(timeoutId);
        if (error.name === 'AbortError') {
          throw new Error('Tempo limite excedido (35s)');
        }
        throw error;
      }

    } catch (error: any) {
      console.error('[IPTV Admin] Error loading playlist:', error);
      toast.error(error.message || 'Erro ao carregar playlist');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAvailableLists();
  }, [loadAvailableLists]);

  useEffect(() => {
    if (customListId) {
      loadPlaylist(customListId);
    }
  }, [customListId, loadPlaylist]);

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
    customListId,
    availableLists,
    changeChannel,
    nextChannel,
    previousChannel,
    selectList: setCustomListId,
    reload: () => customListId && loadPlaylist(customListId)
  };
}
