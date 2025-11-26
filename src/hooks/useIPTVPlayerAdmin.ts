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
}

export function useIPTVPlayerAdmin(selectedListId?: string) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [currentChannel, setCurrentChannel] = useState<Channel | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [customListId, setCustomListId] = useState<string | null>(selectedListId || null);
  const [availableLists, setAvailableLists] = useState<M3UList[]>([]);

  // Load available M3U lists for admin selection
  const loadAvailableLists = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('m3u_custom_lists')
        .select('id, name, description')
        .eq('status', 'published')
        .order('name');

      if (error) throw error;
      setAvailableLists(data || []);
      
      // Auto-select first list if none selected
      if (!selectedListId && data && data.length > 0) {
        setCustomListId(data[0].id);
      } else if (!data || data.length === 0) {
        // No playlists available - stop loading
        setIsLoading(false);
      }
    } catch (error: any) {
      console.error('Error loading lists:', error);
      toast.error('Erro ao carregar listas M3U');
      setIsLoading(false);
    }
  }, [selectedListId]);

  // Load playlist by custom list ID
  const loadPlaylist = useCallback(async (listId: string) => {
    try {
      setIsLoading(true);
      setCustomListId(listId);

      // Load categories and channels
      const { data: categoriesData, error: categoriesError } = await supabase
        .from('m3u_categories')
        .select('*')
        .eq('custom_list_id', listId)
        .order('order_position');

      if (categoriesError) throw categoriesError;

      const { data: channelsData, error: channelsError } = await supabase
        .from('m3u_channels')
        .select('*, m3u_categories(name, display_name)')
        .in('category_id', categoriesData?.map(c => c.id) || [])
        .order('order_position');

      if (channelsError) throw channelsError;

      // Group channels by category
      const categoriesWithChannels = categoriesData?.map(cat => ({
        ...cat,
        channels: channelsData?.filter(ch => ch.category_id === cat.id).map(ch => ({
          ...ch,
          category_name: (ch.m3u_categories as any)?.display_name || (ch.m3u_categories as any)?.name
        })) || []
      })) || [];

      setCategories(categoriesWithChannels);

      // Set first channel as default
      if (channelsData && channelsData.length > 0) {
        setCurrentChannel({
          ...channelsData[0],
          category_name: (channelsData[0].m3u_categories as any)?.display_name
        });
      }

    } catch (error: any) {
      console.error('Error loading playlist:', error);
      toast.error('Erro ao carregar playlist');
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
