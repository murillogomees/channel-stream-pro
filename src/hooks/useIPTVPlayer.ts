import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { authCache } from '@/services/authCacheService';
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

export function useIPTVPlayer() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [currentChannel, setCurrentChannel] = useState<Channel | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [customListId, setCustomListId] = useState<string | null>(null);

  // Load client's assigned M3U custom list
  const loadPlaylist = useCallback(async () => {
    try {
      setIsLoading(true);
      
      // Get current user's client ID - usar cache primeiro
      let userId = authCache.getUserId();
      if (!userId) {
        const { data: { user } } = await supabase.auth.getUser();
        userId = user?.id || null;
      }
      if (!userId) {
        toast.error('Usuário não autenticado');
        return;
      }

      // Get client data
      const { data: cliente } = await supabase
        .from('clientes')
        .select('id')
        .eq('user_id', userId)
        .single();

      if (!cliente) {
        toast.error('Cliente não encontrado');
        return;
      }

      // Get assigned custom list
      const { data: assignment } = await supabase
        .from('client_m3u_custom_assignments')
        .select('custom_list_id')
        .eq('cliente_id', cliente.id)
        .single();

      if (!assignment) {
        toast.error('Nenhuma playlist atribuída a este cliente');
        return;
      }

      setCustomListId(assignment.custom_list_id);

      // Load categories and channels
      const { data: categoriesData, error: categoriesError } = await supabase
        .from('m3u_categories')
        .select('*')
        .eq('custom_list_id', assignment.custom_list_id)
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

      // Load last watched channel or first available
      const lastChannelId = localStorage.getItem('iptv_last_channel');
      if (lastChannelId) {
        const channel = channelsData?.find(ch => ch.id === lastChannelId);
        if (channel) {
          setCurrentChannel({
            ...channel,
            category_name: (channel.m3u_categories as any)?.display_name
          });
          return;
        }
      }

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
    loadPlaylist();
  }, [loadPlaylist]);

  // Save current channel to localStorage
  useEffect(() => {
    if (currentChannel) {
      localStorage.setItem('iptv_last_channel', currentChannel.id);
    }
  }, [currentChannel]);

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
    changeChannel,
    nextChannel,
    previousChannel,
    reload: loadPlaylist
  };
}
