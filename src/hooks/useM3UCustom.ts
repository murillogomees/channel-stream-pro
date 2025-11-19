import { useState, useEffect } from 'react';
import { m3uCustomService, CustomList, CustomCategory, CustomChannel } from '@/services/m3uCustomService';
import { supabase } from '@/integrations/supabase/client';

export function useM3UCustom() {
  const [lists, setLists] = useState<CustomList[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadLists = async () => {
    try {
      setIsLoading(true);
      const data = await m3uCustomService.getAllLists();
      setLists(data);
    } catch (error) {
      console.error('Erro ao carregar listas:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadLists();

    // Subscription para atualizações em tempo real
    const channel = supabase
      .channel('m3u_custom_lists_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'm3u_custom_lists'
        },
        () => {
          loadLists();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  return {
    lists,
    isLoading,
    refresh: loadLists
  };
}

export function useM3UCategories(listId: string | null) {
  const [categories, setCategories] = useState<CustomCategory[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const loadCategories = async () => {
    if (!listId) {
      setCategories([]);
      return;
    }

    try {
      setIsLoading(true);
      const data = await m3uCustomService.getCategories(listId);
      setCategories(data);
    } catch (error) {
      console.error('Erro ao carregar categorias:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadCategories();
  }, [listId]);

  return {
    categories,
    isLoading,
    refresh: loadCategories
  };
}

export function useM3UChannels(categoryId: string | null) {
  const [channels, setChannels] = useState<CustomChannel[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const loadChannels = async () => {
    if (!categoryId) {
      setChannels([]);
      return;
    }

    try {
      setIsLoading(true);
      const data = await m3uCustomService.getChannels(categoryId);
      setChannels(data);
    } catch (error) {
      console.error('Erro ao carregar canais:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadChannels();
  }, [categoryId]);

  return {
    channels,
    isLoading,
    refresh: loadChannels
  };
}
