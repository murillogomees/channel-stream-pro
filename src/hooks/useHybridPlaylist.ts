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
  const initCalledRef = useRef(false);

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
    
    // Get client's assigned playlist - simplified query without nested relation
    const { data: assignment, error } = await supabase
      .from('client_m3u_lists')
      .select('m3u_list_id')
      .eq('client_id', user.id)
      .eq('is_active', true)
      .limit(1)
      .maybeSingle();
    
    if (error) {
      console.warn('[Hybrid] Assignment query error:', error.message);
    }
    
    if (assignment?.m3u_list_id) {
      return assignment.m3u_list_id;
    }
    
    // Fallback: use default playlist (loads from m3u_sync_entries directly)
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

  // Fallback: Load directly from database - progressive loading for better UX
  const loadFromDatabase = useCallback(async (): Promise<boolean> => {
    try {
      setLoadingProgress('Carregando catálogo...');
      
      // Get total count first
      const { count: totalCount } = await supabase
        .from('m3u_sync_entries')
        .select('id', { count: 'exact', head: true });
      
      setTotalChannels(totalCount || 0);
      
      // Load ALL channels in parallel batches for complete content
      const BATCH_SIZE = 10000;
      const batches = Math.ceil((totalCount || 0) / BATCH_SIZE);
      const allChannels: LightChannel[] = [];
      
      // Load first batch immediately for fast initial render
      const { data: firstBatch, error: firstError } = await supabase
        .from('m3u_sync_entries')
        .select('id, title, tvg_logo, group_title')
        .order('group_title', { ascending: true })
        .order('title', { ascending: true })
        .range(0, BATCH_SIZE - 1);
      
      if (firstError) {
        console.error('[Hybrid] Database error:', firstError);
        return false;
      }
      
      if (firstBatch) {
        const firstChannels = firstBatch.map((ch, idx) => ({
          id: ch.id,
          name: ch.title || 'Canal',
          logo: ch.tvg_logo,
          cat: ch.group_title || 'Geral',
          seq: idx,
        }));
        allChannels.push(...firstChannels);
        
        // Show first batch immediately
        allChannelsRef.current = [...allChannels];
        setLoadedChannels(allChannels.length);
        setCategories(groupChannels([...allChannels]));
        setHasPlaylist(true);
        
        console.log(`[Hybrid] First batch: ${allChannels.length} channels`);
      }
      
      // Load remaining batches in background
      if (batches > 1) {
        const loadRemainingBatches = async () => {
          for (let i = 1; i < batches; i++) {
            const start = i * BATCH_SIZE;
            const end = start + BATCH_SIZE - 1;
            
            const { data: batch } = await supabase
              .from('m3u_sync_entries')
              .select('id, title, tvg_logo, group_title')
              .order('group_title', { ascending: true })
              .order('title', { ascending: true })
              .range(start, end);
            
            if (batch) {
              const batchChannels = batch.map((ch, idx) => ({
                id: ch.id,
                name: ch.title || 'Canal',
                logo: ch.tvg_logo,
                cat: ch.group_title || 'Geral',
                seq: start + idx,
              }));
              allChannels.push(...batchChannels);
              
              // Update state periodically (not on every batch to avoid re-renders)
              if (i % 3 === 0 || i === batches - 1) {
                allChannelsRef.current = [...allChannels];
                setLoadedChannels(allChannels.length);
                setCategories(groupChannels([...allChannels]));
              }
            }
          }
          
          console.log(`[Hybrid] DB fully loaded: ${allChannels.length} channels`);
        };
        
        // Start background loading after a delay
        setTimeout(loadRemainingBatches, 100);
      }
      
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

  // Initialize (with guard to prevent duplicate calls)
  const initialize = useCallback(async () => {
    if (initCalledRef.current) return;
    initCalledRef.current = true;
    
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

  // Refresh (resets guard to allow re-init)
  const refresh = useCallback(async () => {
    initCalledRef.current = false;
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
