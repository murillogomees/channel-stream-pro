/**
 * ============================================================================
 * Hybrid Playlist Hook - CDN + Lazy Stream Resolution
 * ============================================================================
 * 
 * Architecture:
 * - Metadata (name, logo, category) → Loaded from CDN/Storage (fast, ~20MB)
 * - Stream URL → Resolved on-demand when user clicks to play (fresh, authenticated)
 * 
 * Benefits:
 * - Initial load: 10-20x faster (metadata only)
 * - Zero background processing during playback
 * - Stream URLs always fresh and properly authenticated
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { 
  loadPlaylistManifest, 
  loadPlaylistChunk, 
  resolveStreamUrl,
  type LightChannel,
  type PlaylistManifest,
  type ResolvedChannel 
} from '@/services/playlistCdnService';

interface Category {
  id: string;
  name: string;
  display_name: string;
  icon: string | null;
  channels: LightChannel[];
}

interface UseHybridPlaylistReturn {
  categories: Category[];
  isLoading: boolean;
  loadingProgress: string;
  totalChannels: number;
  loadedChannels: number;
  hasPlaylist: boolean;
  
  // Stream resolution
  resolveChannel: (channelId: string) => Promise<ResolvedChannel | null>;
  isResolvingStream: boolean;
  
  // Actions
  refresh: () => Promise<void>;
}

const SUPABASE_URL = 'https://sdvyxdghxqmntyoweqbd.supabase.co';

export function useHybridPlaylist(): UseHybridPlaylistReturn {
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadingProgress, setLoadingProgress] = useState('');
  const [totalChannels, setTotalChannels] = useState(0);
  const [loadedChannels, setLoadedChannels] = useState(0);
  const [hasPlaylist, setHasPlaylist] = useState(false);
  const [isResolvingStream, setIsResolvingStream] = useState(false);
  
  const manifestRef = useRef<PlaylistManifest | null>(null);
  const allChannelsRef = useRef<LightChannel[]>([]);
  const playlistKeyRef = useRef<string>('');

  // Group channels by category
  const groupChannels = useCallback((channels: LightChannel[]): Category[] => {
    const categoryMap = new Map<string, Category>();
    
    for (const channel of channels) {
      const catName = channel.cat || 'Sem Categoria';
      
      if (!categoryMap.has(catName)) {
        categoryMap.set(catName, {
          id: `cat-${categoryMap.size}`,
          name: catName,
          display_name: catName,
          icon: null,
          channels: [],
        });
      }
      
      categoryMap.get(catName)!.channels.push(channel);
    }
    
    return Array.from(categoryMap.values());
  }, []);

  // Get user's assigned playlist key
  const getPlaylistKey = useCallback(async (): Promise<string | null> => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;
    
    // Get client's assigned playlist
    const { data: profile } = await supabase
      .from('profiles')
      .select('id')
      .eq('id', user.id)
      .single();
    
    if (!profile) return null;
    
    // Get assigned M3U list
    const { data: assignment } = await supabase
      .from('client_m3u_lists')
      .select('m3u_list_id, m3u_lists(id, name)')
      .eq('client_id', profile.id)
      .eq('is_active', true)
      .single();
    
    if (assignment?.m3u_list_id) {
      return assignment.m3u_list_id;
    }
    
    // Fallback: use default playlist
    return 'default';
  }, []);

  // Load playlist from CDN (metadata only)
  const loadFromCDN = useCallback(async (playlistKey: string): Promise<boolean> => {
    try {
      setLoadingProgress('Carregando catálogo...');
      
      const manifest = await loadPlaylistManifest(playlistKey);
      
      if (!manifest) {
        console.log('[Hybrid] No CDN manifest, falling back to direct load');
        return false;
      }
      
      manifestRef.current = manifest;
      setTotalChannels(manifest.totalChannels);
      setLoadingProgress(`Carregando ${manifest.chunksCount} partes...`);
      
      // Load all chunks in parallel (they're small - metadata only)
      const chunkPromises: Promise<LightChannel[]>[] = [];
      
      for (let i = 0; i < manifest.chunksCount; i++) {
        chunkPromises.push(loadPlaylistChunk(playlistKey, i));
      }
      
      const chunks = await Promise.all(chunkPromises);
      const allChannels = chunks.flat();
      
      allChannelsRef.current = allChannels;
      setLoadedChannels(allChannels.length);
      setCategories(groupChannels(allChannels));
      setHasPlaylist(true);
      
      console.log(`[Hybrid] CDN loaded: ${allChannels.length} channels (metadata only)`);
      
      return true;
    } catch (error) {
      console.error('[Hybrid] CDN load error:', error);
      return false;
    }
  }, [groupChannels]);

  // Fallback: Load directly from database
  const loadFromDatabase = useCallback(async (): Promise<boolean> => {
    try {
      setLoadingProgress('Carregando do banco...');
      
      // Load first batch of channels (without stream_url for speed)
      const { data: channels, error, count } = await supabase
        .from('m3u_sync_entries')
        .select('id, title, tvg_logo, group_title', { count: 'exact' })
        .limit(5000);
      
      if (error || !channels) {
        console.error('[Hybrid] Database error:', error);
        return false;
      }
      
      const lightChannels: LightChannel[] = channels.map((ch, idx) => ({
        id: ch.id,
        name: ch.title || 'Canal',
        logo: ch.tvg_logo,
        cat: ch.group_title || 'Geral',
        seq: idx,
      }));
      
      allChannelsRef.current = lightChannels;
      setTotalChannels(count || lightChannels.length);
      setLoadedChannels(lightChannels.length);
      setCategories(groupChannels(lightChannels));
      setHasPlaylist(true);
      
      console.log(`[Hybrid] DB loaded: ${lightChannels.length}/${count} channels`);
      
      return true;
    } catch (error) {
      console.error('[Hybrid] DB load error:', error);
      return false;
    }
  }, [groupChannels]);

  // Resolve stream URL on-demand (when user clicks to play)
  const resolveChannel = useCallback(async (channelId: string): Promise<ResolvedChannel | null> => {
    setIsResolvingStream(true);
    
    try {
      const resolved = await resolveStreamUrl(channelId);
      return resolved;
    } finally {
      setIsResolvingStream(false);
    }
  }, []);

  // Initialize
  const initialize = useCallback(async () => {
    setIsLoading(true);
    setLoadingProgress('Verificando playlist...');
    
    try {
      const playlistKey = await getPlaylistKey();
      
      if (!playlistKey) {
        console.log('[Hybrid] No playlist assigned');
        setHasPlaylist(false);
        setIsLoading(false);
        return;
      }
      
      playlistKeyRef.current = playlistKey;
      
      // Try CDN first (fast)
      const cdnSuccess = await loadFromCDN(playlistKey);
      
      if (!cdnSuccess) {
        // Fallback to database
        await loadFromDatabase();
      }
      
    } catch (error) {
      console.error('[Hybrid] Init error:', error);
      setHasPlaylist(false);
    } finally {
      setIsLoading(false);
      setLoadingProgress('');
    }
  }, [getPlaylistKey, loadFromCDN, loadFromDatabase]);

  // Refresh
  const refresh = useCallback(async () => {
    setCategories([]);
    allChannelsRef.current = [];
    await initialize();
  }, [initialize]);

  // Auto-init
  useEffect(() => {
    initialize();
  }, [initialize]);

  return {
    categories,
    isLoading,
    loadingProgress,
    totalChannels,
    loadedChannels,
    hasPlaylist,
    resolveChannel,
    isResolvingStream,
    refresh,
  };
}
