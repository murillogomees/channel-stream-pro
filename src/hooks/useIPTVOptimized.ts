/**
 * useIPTVOptimized - Hook otimizado para navegação IPTV
 * Usa views materializadas para performance em alto volume (55k+ canais)
 */

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface CategoryStats {
  category: string;
  channel_count: number;
  healthy_count: number;
  series_count: number;
  live_count: number;
  vod_count: number;
}

export interface SeriesCatalogItem {
  series_name: string;
  category: string;
  episode_count: number;
  max_season: number;
  max_episode: number;
  logo_url: string | null;
  seasons: number[];
  first_episode_id: number;
}

export interface ContentTypeStats {
  content_type: string;
  total: number;
  category_count: number;
  categories: string[];
}

export interface RecentContent {
  id: number;
  name: string;
  category: string | null;
  logo_url: string | null;
  content_type: string;
  is_series: boolean;
  series_name: string | null;
  created_at: string;
}

// Cache TTLs
const CACHE_TTL = {
  CATEGORIES: 5 * 60 * 1000,      // 5 min
  SERIES: 10 * 60 * 1000,         // 10 min
  CONTENT_TYPES: 30 * 60 * 1000,  // 30 min
  RECENT: 2 * 60 * 1000,          // 2 min
  CHANNELS: 60 * 1000,            // 1 min
};

/**
 * Hook para estatísticas de categorias (via materialized view)
 */
export function useCategoryStats() {
  return useQuery({
    queryKey: ['mv-category-stats'],
    queryFn: async (): Promise<CategoryStats[]> => {
      const { data, error } = await supabase
        .from('mv_category_stats')
        .select('*')
        .order('channel_count', { ascending: false });

      if (error) throw error;
      return data || [];
    },
    staleTime: CACHE_TTL.CATEGORIES,
  });
}

/**
 * Hook para catálogo de séries (via materialized view)
 */
export function useSeriesCatalog(category?: string) {
  return useQuery({
    queryKey: ['mv-series-catalog', category],
    queryFn: async (): Promise<SeriesCatalogItem[]> => {
      let query = supabase
        .from('mv_series_catalog')
        .select('*')
        .order('episode_count', { ascending: false });

      if (category) {
        query = query.eq('category', category);
      }

      const { data, error } = await query.limit(100);

      if (error) throw error;
      return data || [];
    },
    staleTime: CACHE_TTL.SERIES,
  });
}

/**
 * Hook para estatísticas por tipo de conteúdo
 */
export function useContentTypeStats() {
  return useQuery({
    queryKey: ['mv-content-type-stats'],
    queryFn: async (): Promise<ContentTypeStats[]> => {
      const { data, error } = await supabase
        .from('mv_content_type_stats')
        .select('*')
        .order('total', { ascending: false });

      if (error) throw error;
      return data || [];
    },
    staleTime: CACHE_TTL.CONTENT_TYPES,
  });
}

/**
 * Hook para conteúdo recente
 */
export function useRecentContent() {
  return useQuery({
    queryKey: ['mv-recent-content'],
    queryFn: async (): Promise<RecentContent[]> => {
      const { data, error } = await supabase
        .from('mv_recent_content')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      return data || [];
    },
    staleTime: CACHE_TTL.RECENT,
  });
}

/**
 * Hook otimizado para buscar canais por categoria
 * Usa índices parciais para queries rápidas
 */
export function useChannelsByCategory(category: string, limit = 20) {
  return useQuery({
    queryKey: ['channels-by-category', category, limit],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('iptv_channels')
        .select('id, name, logo_url, category, content_type, is_series, series_name')
        .eq('category', category)
        .eq('is_healthy', true)
        .limit(limit);

      if (error) throw error;
      return data || [];
    },
    staleTime: CACHE_TTL.CHANNELS,
    enabled: !!category,
  });
}

/**
 * Hook para buscar categorias aleatórias com canais (otimizado)
 * FILTRADO: Apenas canais das playlists "movie" e "series", excluindo "live"
 */
export function useRandomCategoryGroups(count = 4) {
  return useQuery({
    queryKey: ['random-category-groups-by-playlist', count],
    queryFn: async () => {
      // Buscar IDs das playlists permitidas (movie e series)
      const { data: allowedPlaylists } = await supabase
        .from('iptv_playlists')
        .select('id')
        .in('slug', ['movie', 'series']);

      if (!allowedPlaylists || allowedPlaylists.length === 0) return [];

      const allowedPlaylistIds = allowedPlaylists.map(p => p.id);

      // Buscar canais das playlists permitidas
      const { data: playlistChannels } = await supabase
        .from('iptv_playlist_channels')
        .select('channel_id')
        .in('playlist_id', allowedPlaylistIds)
        .limit(5000);

      if (!playlistChannels || playlistChannels.length === 0) return [];

      const allowedChannelIds = playlistChannels.map(pc => pc.channel_id);

      // Buscar canais com suas categorias
      const { data: channels } = await supabase
        .from('iptv_channels')
        .select('id, name, logo_url, category, content_type, is_series')
        .in('id', allowedChannelIds.slice(0, 1000)) // Limitar para performance
        .eq('is_healthy', true);

      if (!channels || channels.length === 0) return [];

      // Agrupar por categoria
      const categoryGroups: Record<string, typeof channels> = {};
      for (const ch of channels) {
        const cat = ch.category || 'Conteúdo';
        if (!categoryGroups[cat]) categoryGroups[cat] = [];
        categoryGroups[cat].push(ch);
      }

      // Filtrar categorias com pelo menos 5 canais e shuffle
      const validCategories = Object.entries(categoryGroups)
        .filter(([_, chs]) => chs.length >= 5)
        .sort(() => Math.random() - 0.5)
        .slice(0, count);

      return validCategories.map(([name, chs]) => ({
        name,
        channels: chs.sort(() => Math.random() - 0.5).slice(0, 20),
        totalCount: chs.length,
      }));
    },
    staleTime: 30 * 1000,
  });
}

/**
 * Hook para recomendações de IA (filmes e séries)
 */
export function useAIRecommendations(favorites: string[] = []) {
  return useQuery({
    queryKey: ['ai-recommendations', favorites],
    queryFn: async () => {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-content-recommend`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({ favorites }),
        }
      );

      if (!response.ok) {
        throw new Error('Failed to get AI recommendations');
      }

      const data = await response.json();
      return data.groups || [];
    },
    staleTime: 5 * 60 * 1000, // 5 minutos
    retry: 1,
  });
}

/**
 * Hook para episódios de uma série
 */
export function useSeriesEpisodes(seriesName: string, season?: number) {
  return useQuery({
    queryKey: ['series-episodes', seriesName, season],
    queryFn: async () => {
      let query = supabase
        .from('iptv_channels')
        .select('id, name, logo_url, season_number, episode_number, episode_title')
        .eq('series_name', seriesName)
        .eq('is_healthy', true)
        .order('season_number')
        .order('episode_number');

      if (season) {
        query = query.eq('season_number', season);
      }

      const { data, error } = await query;

      if (error) throw error;
      return data || [];
    },
    staleTime: CACHE_TTL.SERIES,
    enabled: !!seriesName,
  });
}

/**
 * Hook para dashboard stats (via materialized view)
 */
export function useDashboardSummary() {
  return useQuery({
    queryKey: ['mv-dashboard-summary'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('mv_dashboard_summary')
        .select('*')
        .single();

      if (error) throw error;
      return data;
    },
    staleTime: CACHE_TTL.CATEGORIES,
  });
}
