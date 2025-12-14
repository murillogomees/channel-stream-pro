/**
 * IPTV Realtime Stats Hook
 * Provides realtime statistics for all IPTV admin tabs
 */

import { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface ChannelStats {
  total: number;
  healthy: number;
  unhealthy: number;
  categories: number;
  series: number;
  live: number;
  vod: number;
}

export interface SeriesStats {
  totalEpisodes: number;
  totalSeries: number;
  totalCategories: number;
  unorganized: number;
}

export interface PlaylistStats {
  total: number;
  public: number;
  private: number;
}

export interface EPGStats {
  total: number;
  active: number;
  upcoming: number;
  channels: number;
}

export interface TranscodeStats {
  total: number;
  pending: number;
  processing: number;
  completed: number;
  failed: number;
}

export interface CacheStats {
  total: number;
  warm: number;
  cold: number;
  expired: number;
}

// Channels Stats Hook
export function useChannelStats() {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['iptv-channel-stats'],
    queryFn: async (): Promise<ChannelStats> => {
      const [totalRes, healthyRes, categoriesRes, seriesRes, liveRes, vodRes] = await Promise.all([
        supabase.from('iptv_channels').select('id', { count: 'exact', head: true }),
        supabase.from('iptv_channels').select('id', { count: 'exact', head: true }).eq('is_healthy', true),
        supabase.from('iptv_channels').select('category').not('category', 'is', null),
        supabase.from('iptv_channels').select('series_name').eq('is_series', true).not('series_name', 'is', null),
        supabase.from('iptv_channels').select('id', { count: 'exact', head: true }).eq('content_type', 'live'),
        supabase.from('iptv_channels').select('id', { count: 'exact', head: true }).eq('content_type', 'vod'),
      ]);

      const uniqueCategories = new Set((categoriesRes.data || []).map(c => c.category)).size;
      const uniqueSeries = new Set((seriesRes.data || []).map(s => s.series_name)).size;

      return {
        total: totalRes.count || 0,
        healthy: healthyRes.count || 0,
        unhealthy: (totalRes.count || 0) - (healthyRes.count || 0),
        categories: uniqueCategories,
        series: uniqueSeries,
        live: liveRes.count || 0,
        vod: vodRes.count || 0,
      };
    },
    refetchInterval: 10000,
  });

  // Realtime subscription
  useEffect(() => {
    const channel = supabase
      .channel('iptv-channels-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'iptv_channels' }, () => {
        queryClient.invalidateQueries({ queryKey: ['iptv-channel-stats'] });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  return query;
}

// Series Stats Hook
export function useSeriesStats() {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['iptv-series-stats'],
    queryFn: async (): Promise<SeriesStats> => {
      const [episodesRes, seriesRes, unorganizedRes] = await Promise.all([
        supabase.from('iptv_channels').select('id', { count: 'exact', head: true }).eq('is_series', true),
        supabase.from('iptv_channels').select('series_name, category').eq('is_series', true).not('series_name', 'is', null),
        supabase.from('iptv_channels').select('id', { count: 'exact', head: true }).or('is_series.is.null,is_series.eq.false').is('series_name', null),
      ]);

      const uniqueSeries = new Set((seriesRes.data || []).map(s => s.series_name)).size;
      const uniqueCategories = new Set((seriesRes.data || []).map(s => s.category).filter(Boolean)).size;

      return {
        totalEpisodes: episodesRes.count || 0,
        totalSeries: uniqueSeries,
        totalCategories: uniqueCategories,
        unorganized: unorganizedRes.count || 0,
      };
    },
    refetchInterval: 10000,
  });

  useEffect(() => {
    const channel = supabase
      .channel('iptv-series-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'iptv_channels' }, () => {
        queryClient.invalidateQueries({ queryKey: ['iptv-series-stats'] });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  return query;
}

// Playlist Stats Hook
export function usePlaylistStats() {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['iptv-playlist-stats'],
    queryFn: async (): Promise<PlaylistStats> => {
      const [totalRes, publicRes] = await Promise.all([
        supabase.from('iptv_playlists').select('id', { count: 'exact', head: true }),
        supabase.from('iptv_playlists').select('id', { count: 'exact', head: true }).eq('is_public', true),
      ]);

      return {
        total: totalRes.count || 0,
        public: publicRes.count || 0,
        private: (totalRes.count || 0) - (publicRes.count || 0),
      };
    },
    refetchInterval: 10000,
  });

  useEffect(() => {
    const channel = supabase
      .channel('iptv-playlists-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'iptv_playlists' }, () => {
        queryClient.invalidateQueries({ queryKey: ['iptv-playlist-stats'] });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  return query;
}

// EPG Stats Hook
export function useEPGStats() {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['iptv-epg-stats'],
    queryFn: async (): Promise<EPGStats> => {
      const now = new Date().toISOString();
      const [totalRes, activeRes, upcomingRes, channelsRes] = await Promise.all([
        supabase.from('epg_programs').select('id', { count: 'exact', head: true }),
        supabase.from('epg_programs').select('id', { count: 'exact', head: true }).lte('start_time', now).gte('end_time', now),
        supabase.from('epg_programs').select('id', { count: 'exact', head: true }).gt('start_time', now),
        supabase.from('epg_programs').select('channel_id'),
      ]);

      const uniqueChannels = new Set((channelsRes.data || []).map(c => c.channel_id)).size;

      return {
        total: totalRes.count || 0,
        active: activeRes.count || 0,
        upcoming: upcomingRes.count || 0,
        channels: uniqueChannels,
      };
    },
    refetchInterval: 30000,
  });

  useEffect(() => {
    const channel = supabase
      .channel('iptv-epg-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'epg_programs' }, () => {
        queryClient.invalidateQueries({ queryKey: ['iptv-epg-stats'] });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  return query;
}

// Transcode Stats Hook
export function useTranscodeStats() {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['iptv-transcode-stats'],
    queryFn: async (): Promise<TranscodeStats> => {
      const [totalRes, pendingRes, processingRes, completedRes, failedRes] = await Promise.all([
        supabase.from('iptv_transcode_jobs').select('id', { count: 'exact', head: true }),
        supabase.from('iptv_transcode_jobs').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
        supabase.from('iptv_transcode_jobs').select('id', { count: 'exact', head: true }).eq('status', 'processing'),
        supabase.from('iptv_transcode_jobs').select('id', { count: 'exact', head: true }).eq('status', 'completed'),
        supabase.from('iptv_transcode_jobs').select('id', { count: 'exact', head: true }).eq('status', 'failed'),
      ]);

      return {
        total: totalRes.count || 0,
        pending: pendingRes.count || 0,
        processing: processingRes.count || 0,
        completed: completedRes.count || 0,
        failed: failedRes.count || 0,
      };
    },
    refetchInterval: 5000,
  });

  useEffect(() => {
    const channel = supabase
      .channel('iptv-transcode-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'iptv_transcode_jobs' }, () => {
        queryClient.invalidateQueries({ queryKey: ['iptv-transcode-stats'] });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  return query;
}

// Cache Stats Hook
export function useCacheStats() {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['iptv-cache-stats'],
    queryFn: async (): Promise<CacheStats> => {
      const now = new Date().toISOString();
      const [totalRes, warmRes, expiredRes] = await Promise.all([
        supabase.from('iptv_cdn_cache').select('id', { count: 'exact', head: true }),
        supabase.from('iptv_cdn_cache').select('id', { count: 'exact', head: true }).eq('is_warm', true),
        supabase.from('iptv_cdn_cache').select('id', { count: 'exact', head: true }).lt('expires_at', now),
      ]);

      const total = totalRes.count || 0;
      const warm = warmRes.count || 0;

      return {
        total,
        warm,
        cold: total - warm,
        expired: expiredRes.count || 0,
      };
    },
    refetchInterval: 10000,
  });

  useEffect(() => {
    const channel = supabase
      .channel('iptv-cache-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'iptv_cdn_cache' }, () => {
        queryClient.invalidateQueries({ queryKey: ['iptv-cache-stats'] });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  return query;
}
