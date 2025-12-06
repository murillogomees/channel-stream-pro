/**
 * useHomeChannels - Lightweight hook for home page
 * 
 * Loads ONLY 500 channels for the home view.
 * No background loading, no sync - just the initial batch.
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

const MAX_HOME_CHANNELS = 500;
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

      // Get user's playlist assignment
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user?.id) {
        setError('Não autenticado');
        setIsLoading(false);
        return;
      }

      // Get playlist assignment with slug
      const { data: assignment } = await supabase
        .from('client_m3u_custom_assignments')
        .select(`
          custom_list_id,
          m3u_custom_lists:custom_list_id (
            id,
            name,
            slug,
            cdn_url,
            status
          )
        `)
        .eq('cliente_id', session.user.id)
        .limit(1)
        .maybeSingle();

      const customList = (assignment as any)?.m3u_custom_lists;
      let playlistSlug = customList?.slug;
      
      if (!playlistSlug) {
        // Try default playlist
        const { data: defaultList } = await supabase
          .from('m3u_custom_lists')
          .select('slug')
          .eq('status', 'active')
          .limit(1)
          .maybeSingle();

        if (!defaultList?.slug) {
          setError('Nenhuma playlist disponível');
          setIsLoading(false);
          return;
        }

        playlistSlug = defaultList.slug;
      }

      await loadFromPlaylistServe(playlistSlug);
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
      const params = new URLSearchParams({ 
        offset: '0', 
        limit: String(MAX_HOME_CHANNELS) 
      });
      
      const response = await fetch(`${endpoint}?${params}`);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      
      const data = await response.json();
      
      if (!data.channels || data.channels.length === 0) {
        setError('Nenhum canal disponível');
        return;
      }
      
      console.log(`[HomeChannels] Loaded ${Math.min(data.channels.length, MAX_HOME_CHANNELS)} channels for home`);
      
      // Map to Channel format - ONLY take MAX_HOME_CHANNELS
      const mappedChannels: Channel[] = data.channels.slice(0, MAX_HOME_CHANNELS).map((ch: any, idx: number) => ({
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
      
      setChannels(mappedChannels);
      loadedRef.current = true;
      
    } catch (err) {
      console.error('[HomeChannels] Playlist serve error:', err);
      throw err;
    }
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
