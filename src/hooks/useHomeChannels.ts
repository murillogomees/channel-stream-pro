/**
 * useHomeChannels - Full playlist loading hook for home page
 * 
 * Loads ALL channels from the playlist progressively.
 * First batch renders immediately, rest loads in background.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface Channel {
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

const INITIAL_BATCH_SIZE = 1000;
const BATCH_SIZE = 5000;
const PLAYLIST_SERVE_URL = 'https://sdvyxdghxqmntyoweqbd.supabase.co/functions/v1/playlist-serve';

export function useHomeChannels() {
  const [channels, setChannels] = useState<Channel[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const loadedRef = useRef(false);

  const loadChannels = useCallback(async () => {
    if (loadedRef.current) return;
    
    try {
      setIsLoading(true);
      setError(null);

      // Get the active playlist key from playlist_sources (not m3u_custom_lists)
      const { data: sources, error: sourcesError } = await supabase
        .from('playlist_sources')
        .select('key')
        .eq('sync_enabled', true)
        .limit(1);

      if (sourcesError) {
        console.error('[HomeChannels] Error fetching sources:', sourcesError);
      }

      const playlistKey = sources?.[0]?.key;
      
      if (!playlistKey) {
        console.log('[HomeChannels] No active playlist source found');
        setError('Nenhuma playlist disponível');
        setIsLoading(false);
        return;
      }

      console.log(`[HomeChannels] Using playlist key: ${playlistKey}`);
      await loadFromPlaylistServe(playlistKey);
    } catch (err) {
      console.error('[HomeChannels] Error:', err);
      setError('Erro ao carregar conteúdo');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const loadFromPlaylistServe = async (playlistSlug: string) => {
    try {
      const endpoint = `${PLAYLIST_SERVE_URL}/playlist/${playlistSlug}`;
      
      // Load first batch immediately for fast render
      const firstParams = new URLSearchParams({ 
        offset: '0', 
        limit: String(INITIAL_BATCH_SIZE) 
      });
      
      const firstResponse = await fetch(`${endpoint}?${firstParams}`);
      
      if (!firstResponse.ok) {
        throw new Error(`HTTP ${firstResponse.status}`);
      }
      
      const firstData = await firstResponse.json();
      
      if (!firstData.channels || firstData.channels.length === 0) {
        setError('Nenhum canal disponível');
        return;
      }
      
      const totalCount = firstData.total || firstData.channels.length;
      console.log(`[HomeChannels] First batch: ${firstData.channels.length}, total: ${totalCount}`);
      
      // Map first batch immediately
      const allChannels: Channel[] = firstData.channels.map((ch: any, idx: number) => ({
        id: ch.id || `ch-${idx}`,
        name: ch.name || ch.title || 'Sem nome',
        stream_url: ch.stream_url || ch.url || '',
        tvg_logo: ch.tvg_logo || ch.logo || null,
        tvg_id: ch.tvg_id || null,
        category_id: ch.category_id || 'default',
        category_name: ch.category_name || ch.group_title || 'Geral',
        group_title: ch.group_title || ch.category_name || 'Geral',
        order_position: ch.order_position || idx,
      }));
      
      // Show first batch immediately
      setChannels([...allChannels]);
      loadedRef.current = true;
      
      // Load remaining batches in background
      if (totalCount > INITIAL_BATCH_SIZE) {
        loadRemainingBatches(endpoint, allChannels, totalCount);
      }
      
    } catch (err) {
      console.error('[HomeChannels] Playlist serve error:', err);
      throw err;
    }
  };

  const loadRemainingBatches = async (endpoint: string, currentChannels: Channel[], totalCount: number) => {
    let offset = INITIAL_BATCH_SIZE;
    const allChannels = [...currentChannels];
    
    while (offset < totalCount) {
      try {
        const params = new URLSearchParams({ 
          offset: String(offset), 
          limit: String(BATCH_SIZE) 
        });
        
        const response = await fetch(`${endpoint}?${params}`);
        
        if (!response.ok) {
          console.warn(`[HomeChannels] Batch at ${offset} failed`);
          break;
        }
        
        const data = await response.json();
        
        if (!data.channels || data.channels.length === 0) {
          break;
        }
        
        // Map and append new channels
        const newChannels = data.channels.map((ch: any, idx: number) => ({
          id: ch.id || `ch-${offset + idx}`,
          name: ch.name || ch.title || 'Sem nome',
          stream_url: ch.stream_url || ch.url || '',
          tvg_logo: ch.tvg_logo || ch.logo || null,
          tvg_id: ch.tvg_id || null,
          category_id: ch.category_id || 'default',
          category_name: ch.category_name || ch.group_title || 'Geral',
          group_title: ch.group_title || ch.category_name || 'Geral',
          order_position: ch.order_position || offset + idx,
        }));
        
        allChannels.push(...newChannels);
        
        // Update state with appended channels (no reorder, just append)
        setChannels([...allChannels]);
        
        offset += BATCH_SIZE;
        console.log(`[HomeChannels] Loaded ${allChannels.length} of ${totalCount}`);
        
        // Small delay to prevent overwhelming the API
        await new Promise(resolve => setTimeout(resolve, 100));
        
      } catch (err) {
        console.error('[HomeChannels] Batch error:', err);
        break;
      }
    }
    
    console.log(`[HomeChannels] Complete: ${allChannels.length} channels loaded`);
  };

  useEffect(() => {
    loadChannels();
  }, [loadChannels]);

  return {
    channels,
    isLoading,
    error,
    refresh: () => {
      loadedRef.current = false;
      loadChannels();
    },
  };
}

export default useHomeChannels;
