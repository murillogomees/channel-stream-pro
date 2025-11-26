import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export function useFavoriteChannels() {
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);

  const loadFavorites = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Get from localStorage for now (can be migrated to Supabase table later)
      const stored = localStorage.getItem(`iptv_favorites_${user.id}`);
      if (stored) {
        setFavorites(new Set(JSON.parse(stored)));
      }
    } catch (error) {
      console.error('Error loading favorites:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadFavorites();
  }, [loadFavorites]);

  const toggleFavorite = useCallback(async (channelId: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error('Usuário não autenticado');
        return;
      }

      setFavorites(prev => {
        const newFavorites = new Set(prev);
        if (newFavorites.has(channelId)) {
          newFavorites.delete(channelId);
          toast.success('Removido dos favoritos');
        } else {
          newFavorites.add(channelId);
          toast.success('Adicionado aos favoritos');
        }

        // Save to localStorage
        localStorage.setItem(`iptv_favorites_${user.id}`, JSON.stringify([...newFavorites]));
        
        return newFavorites;
      });
    } catch (error) {
      console.error('Error toggling favorite:', error);
      toast.error('Erro ao atualizar favoritos');
    }
  }, []);

  const isFavorite = useCallback((channelId: string) => {
    return favorites.has(channelId);
  }, [favorites]);

  return {
    favorites: Array.from(favorites),
    isLoading,
    toggleFavorite,
    isFavorite
  };
}
