/**
 * useFavorites - Hook para gerenciar favoritos do usuário
 */

import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";

// Use any type for favorites table since it's not in types yet
type FavoritesTable = {
  id: string;
  profile_id: string;
  content_id: string;
  content_type: string;
  content_name: string;
  content_logo: string | null;
  content_category: string | null;
  metadata: Record<string, any> | null;
  created_at: string;
};

export interface FavoriteItem {
  id: string;
  profile_id: string;
  content_id: string;
  content_type: string;
  content_name: string;
  content_logo: string | null;
  content_category: string | null;
  metadata: Record<string, any> | null;
  created_at: string;
}

interface AddFavoriteInput {
  content_id: string;
  content_type: string;
  content_name: string;
  content_logo?: string;
  content_category?: string;
  metadata?: Record<string, any>;
}

export function useFavorites(profileId: string | null) {
  const [favorites, setFavorites] = useState<FavoriteItem[]>([]);
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch favorites
  const fetchFavorites = useCallback(async () => {
    if (!profileId) {
      setFavorites([]);
      setFavoriteIds(new Set());
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      const { data, error: fetchError } = await (supabase
        .from("favorites" as any)
        .select("*")
        .eq("profile_id", profileId)
        .order("created_at", { ascending: false }) as any);

      if (fetchError) throw fetchError;

      const items: FavoriteItem[] = (data || []).map((item: FavoritesTable) => ({
        id: item.id,
        profile_id: item.profile_id,
        content_id: item.content_id,
        content_type: item.content_type,
        content_name: item.content_name,
        content_logo: item.content_logo,
        content_category: item.content_category,
        metadata: item.metadata,
        created_at: item.created_at,
      }));

      setFavorites(items);
      setFavoriteIds(new Set(items.map(item => item.content_id)));
    } catch (err: any) {
      console.error("Error fetching favorites:", err);
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, [profileId]);

  // Check if content is favorited
  const isFavorite = useCallback((contentId: string): boolean => {
    return favoriteIds.has(contentId);
  }, [favoriteIds]);

  // Add to favorites
  const addToFavorites = useCallback(async (input: AddFavoriteInput): Promise<boolean> => {
    if (!profileId) {
      toast.error("Selecione um perfil primeiro");
      return false;
    }

    // Already favorited
    if (favoriteIds.has(input.content_id)) {
      return true;
    }

    try {
      const { data, error: insertError } = await (supabase
        .from("favorites" as any)
        .insert({
          profile_id: profileId,
          content_id: input.content_id,
          content_type: input.content_type,
          content_name: input.content_name,
          content_logo: input.content_logo || null,
          content_category: input.content_category || null,
          metadata: input.metadata || {},
        })
        .select()
        .single() as any);

      if (insertError) throw insertError;

      const newItem: FavoriteItem = {
        id: data.id,
        profile_id: data.profile_id,
        content_id: data.content_id,
        content_type: data.content_type,
        content_name: data.content_name,
        content_logo: data.content_logo,
        content_category: data.content_category,
        metadata: data.metadata,
        created_at: data.created_at,
      };

      // Update local state optimistically
      setFavorites(prev => [newItem, ...prev]);
      setFavoriteIds(prev => new Set([...prev, input.content_id]));

      toast.success("Adicionado aos favoritos");
      return true;
    } catch (err: any) {
      console.error("Error adding to favorites:", err);
      toast.error("Erro ao adicionar aos favoritos");
      return false;
    }
  }, [profileId, favoriteIds]);

  // Remove from favorites
  const removeFromFavorites = useCallback(async (contentId: string): Promise<boolean> => {
    if (!profileId) return false;

    try {
      const { error: deleteError } = await (supabase
        .from("favorites" as any)
        .delete()
        .eq("profile_id", profileId)
        .eq("content_id", contentId) as any);

      if (deleteError) throw deleteError;

      // Update local state
      setFavorites(prev => prev.filter(item => item.content_id !== contentId));
      setFavoriteIds(prev => {
        const newSet = new Set(prev);
        newSet.delete(contentId);
        return newSet;
      });

      toast.success("Removido dos favoritos");
      return true;
    } catch (err: any) {
      console.error("Error removing from favorites:", err);
      toast.error("Erro ao remover dos favoritos");
      return false;
    }
  }, [profileId]);

  // Toggle favorite
  const toggleFavorite = useCallback(async (input: AddFavoriteInput): Promise<boolean> => {
    if (isFavorite(input.content_id)) {
      return removeFromFavorites(input.content_id);
    }
    return addToFavorites(input);
  }, [isFavorite, addToFavorites, removeFromFavorites]);

  // Get favorites by category
  const getFavoritesByCategory = useCallback((category: string): FavoriteItem[] => {
    return favorites.filter(item => item.content_category === category);
  }, [favorites]);

  // Get favorites by type
  const getFavoritesByType = useCallback((type: string): FavoriteItem[] => {
    return favorites.filter(item => item.content_type === type);
  }, [favorites]);

  // Initial fetch
  useEffect(() => {
    fetchFavorites();
  }, [fetchFavorites]);

  return {
    favorites,
    favoriteIds,
    isLoading,
    error,
    isFavorite,
    addToFavorites,
    removeFromFavorites,
    toggleFavorite,
    getFavoritesByCategory,
    getFavoritesByType,
    refresh: fetchFavorites,
  };
}
