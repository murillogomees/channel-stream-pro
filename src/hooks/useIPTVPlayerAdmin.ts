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
        // No default playlist available - stop loading
        setIsLoading(false);
        toast.error('Nenhuma playlist padrão encontrada');
      }
    } catch (error: any) {
      console.error('Error loading lists:', error);
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

      if (listError) throw listError;

      // Fetch and parse M3U file
      const response = await fetch(listData.file_url);
      const m3uContent = await response.text();
      
      // Parse M3U content
      const lines = m3uContent.split('\n');
      const categoriesMap = new Map<string, Category>();
      let currentChannelInfo: any = null;

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        
        if (line.startsWith('#EXTINF:')) {
          // Parse channel info
          const tvgLogoMatch = line.match(/tvg-logo="([^"]*)"/);
          const tvgIdMatch = line.match(/tvg-id="([^"]*)"/);
          const groupTitleMatch = line.match(/group-title="([^"]*)"/);
          const nameMatch = line.match(/,(.+)$/);
          
          currentChannelInfo = {
            tvg_logo: tvgLogoMatch ? tvgLogoMatch[1] : null,
            tvg_id: tvgIdMatch ? tvgIdMatch[1] : null,
            group_title: groupTitleMatch ? groupTitleMatch[1] : 'Sem Categoria',
            name: nameMatch ? nameMatch[1] : 'Canal',
          };
        } else if (line && !line.startsWith('#') && currentChannelInfo) {
          // This is the stream URL
          const categoryName = currentChannelInfo.group_title;
          
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
            id: `ch-${category.channels.length}`,
            name: currentChannelInfo.name,
            stream_url: line,
            tvg_logo: currentChannelInfo.tvg_logo,
            tvg_id: currentChannelInfo.tvg_id,
            category_id: category.id,
            category_name: categoryName,
            order_position: category.channels.length
          });
          
          currentChannelInfo = null;
        }
      }

      const categoriesArray = Array.from(categoriesMap.values());
      setCategories(categoriesArray);

      // Set first channel as default
      if (categoriesArray.length > 0 && categoriesArray[0].channels.length > 0) {
        setCurrentChannel(categoriesArray[0].channels[0]);
      }

    } catch (error: any) {
      console.error('Error loading playlist:', error);
      toast.error('Erro ao carregar playlist padrão');
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
