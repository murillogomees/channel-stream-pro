import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export function useM3UListFavorites() {
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);

  const loadFavorites = async () => {
    try {
      setIsLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('m3u_list_favorites')
        .select('m3u_list_id')
        .eq('admin_id', user.id);

      if (error) throw error;
      
      const favoriteIds = new Set(data?.map(f => f.m3u_list_id) || []);
      setFavorites(favoriteIds);
    } catch (error: any) {
      console.error('Error loading favorites:', error);
      toast.error('Erro ao carregar favoritos', {
        description: error.message
      });
    } finally {
      setIsLoading(false);
    }
  };

  const toggleFavorite = async (listId: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const isFavorite = favorites.has(listId);

      if (isFavorite) {
        // Remove from favorites
        const { error } = await supabase
          .from('m3u_list_favorites')
          .delete()
          .eq('admin_id', user.id)
          .eq('m3u_list_id', listId);

        if (error) throw error;

        setFavorites(prev => {
          const newSet = new Set(prev);
          newSet.delete(listId);
          return newSet;
        });
        toast.success('Removido dos favoritos');
      } else {
        // Add to favorites
        const { error } = await supabase
          .from('m3u_list_favorites')
          .insert({
            admin_id: user.id,
            m3u_list_id: listId
          });

        if (error) throw error;

        setFavorites(prev => new Set([...prev, listId]));
        toast.success('Adicionado aos favoritos');
      }
    } catch (error: any) {
      console.error('Error toggling favorite:', error);
      toast.error('Erro ao atualizar favoritos', {
        description: error.message
      });
    }
  };

  const isFavorite = (listId: string) => favorites.has(listId);

  useEffect(() => {
    loadFavorites();
  }, []);

  return {
    favorites,
    isLoading,
    toggleFavorite,
    isFavorite,
    loadFavorites
  };
}
