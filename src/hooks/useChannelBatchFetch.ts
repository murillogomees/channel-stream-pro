/**
 * useChannelBatchFetch Hook
 * 
 * Handles batch fetching of channels with infinite scroll support
 * Integrates with IndexedDB cache for instant loading
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { playlistCacheService } from '@/services/playlistCacheService';

export interface Channel {
  id: string;
  name: string;
  stream_url: string;
  tvg_logo: string | null;
  tvg_id: string | null;
  category_id: string;
  category_name?: string;
  group_title?: string;
  order_position: number;
}

interface UseChannelBatchFetchOptions {
  userId?: string;
  sourceId?: string;
  batchSize?: number;
  cacheKey?: string;
  enabled?: boolean;
}

async function fetchChannelsBatch(
  offset: number, 
  limit: number, 
  sourceId?: string
): Promise<{ channels: Channel[]; total: number }> {
  // Get total count using raw query
  const { count: totalCount } = await supabase
    .from('m3u_channels')
    .select('*', { count: 'exact', head: true });

  // Get channels using explicit typing
  let channelsData: any[] = [];
  
  const baseSelect = 'id, name, stream_url, tvg_logo, tvg_id, category_id, order_position';
  
  const { data, error } = sourceId
    ? await (supabase.from('m3u_channels').select(baseSelect) as any)
        .eq('source_id', sourceId)
        .order('order_position')
        .range(offset, offset + limit - 1)
    : await (supabase.from('m3u_channels').select(baseSelect) as any)
        .order('order_position')
        .range(offset, offset + limit - 1);
  
  if (error) throw error;
  channelsData = data || [];

  // Fetch category names
  const categoryIds = [...new Set(channelsData.map(c => c.category_id).filter(Boolean))] as string[];
  let categoryMap: Record<string, string> = {};

  if (categoryIds.length > 0) {
    const { data: categories } = await supabase
      .from('m3u_categories')
      .select('id, name')
      .in('id', categoryIds);

    if (categories) {
      categoryMap = Object.fromEntries(categories.map(c => [c.id, c.name]));
    }
  }

  const channels: Channel[] = channelsData.map(c => ({
    id: c.id,
    name: c.name,
    stream_url: c.stream_url,
    tvg_logo: c.tvg_logo,
    tvg_id: c.tvg_id,
    category_id: c.category_id,
    order_position: c.order_position,
    category_name: categoryMap[c.category_id] || 'Sem categoria',
    group_title: categoryMap[c.category_id] || 'Sem categoria',
  }));

  return { channels, total: totalCount || 0 };
}

export function useChannelBatchFetch(options: UseChannelBatchFetchOptions = {}) {
  const {
    sourceId,
    batchSize = 500,
    cacheKey = 'default_playlist',
    enabled = true,
  } = options;

  const [channels, setChannels] = useState<Channel[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loadedCount, setLoadedCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isCached, setIsCached] = useState(false);

  const offsetRef = useRef(0);
  const isFetchingRef = useRef(false);
  const mountedRef = useRef(true);

  // Load initial data (from cache or fetch)
  const loadInitial = useCallback(async () => {
    if (!enabled || isFetchingRef.current) return;
    
    isFetchingRef.current = true;
    setIsLoading(true);
    setError(null);

    try {
      // Try cache first
      const cached = await playlistCacheService.getByUrl(cacheKey);
      
      if (cached && cached.channels.length > 0) {
        console.log(`[BatchFetch] Loaded ${cached.channels.length} channels from cache`);
        
        if (mountedRef.current) {
          setChannels(cached.channels);
          setTotalCount(cached.totalChannels);
          setLoadedCount(cached.channels.length);
          setIsLoading(false);
          setIsLoadingMore(false);
          setHasMore(cached.channels.length < cached.totalChannels);
          setIsCached(true);
          offsetRef.current = cached.channels.length;
        }
        
        isFetchingRef.current = false;
        return;
      }

      // Fetch from database
      const result = await fetchChannelsBatch(0, batchSize, sourceId);
      
      if (mountedRef.current) {
        setChannels(result.channels);
        setTotalCount(result.total);
        setLoadedCount(result.channels.length);
        setIsLoading(false);
        setIsLoadingMore(false);
        setHasMore(result.channels.length < result.total);
        setIsCached(false);
        offsetRef.current = result.channels.length;

        // Save to cache
        await playlistCacheService.save(cacheKey, result.channels, result.total);
      }
    } catch (err) {
      console.error('[BatchFetch] Initial load error:', err);
      if (mountedRef.current) {
        setIsLoading(false);
        setError(err instanceof Error ? err.message : 'Erro ao carregar canais');
      }
    } finally {
      isFetchingRef.current = false;
    }
  }, [enabled, cacheKey, batchSize, sourceId]);

  // Load more channels (infinite scroll)
  const loadMore = useCallback(async () => {
    if (!hasMore || isLoadingMore || isFetchingRef.current) return;

    isFetchingRef.current = true;
    setIsLoadingMore(true);

    try {
      const result = await fetchChannelsBatch(offsetRef.current, batchSize, sourceId);

      if (mountedRef.current) {
        setChannels(prev => [...prev, ...result.channels]);
        setTotalCount(result.total);
        setLoadedCount(prev => prev + result.channels.length);
        setIsLoadingMore(false);
        setHasMore(offsetRef.current + result.channels.length < result.total);
        setIsCached(false);

        offsetRef.current += result.channels.length;

        // Update cache with new channels
        await playlistCacheService.appendChannels(
          cacheKey,
          result.channels,
          result.total
        );
      }
    } catch (err) {
      console.error('[BatchFetch] Load more error:', err);
      if (mountedRef.current) {
        setIsLoadingMore(false);
        setError(err instanceof Error ? err.message : 'Erro ao carregar mais canais');
      }
    } finally {
      isFetchingRef.current = false;
    }
  }, [hasMore, isLoadingMore, batchSize, cacheKey, sourceId]);

  // Refresh all data
  const refresh = useCallback(async () => {
    await playlistCacheService.clearAll();
    offsetRef.current = 0;
    setChannels([]);
    setTotalCount(0);
    setLoadedCount(0);
    setIsLoading(true);
    setIsLoadingMore(false);
    setHasMore(true);
    setError(null);
    setIsCached(false);
    await loadInitial();
  }, [loadInitial]);

  // Initial load
  useEffect(() => {
    mountedRef.current = true;
    loadInitial();

    return () => {
      mountedRef.current = false;
    };
  }, [loadInitial]);

  return {
    channels,
    totalCount,
    loadedCount,
    isLoading,
    isLoadingMore,
    hasMore,
    error,
    isCached,
    loadMore,
    refresh,
  };
}
