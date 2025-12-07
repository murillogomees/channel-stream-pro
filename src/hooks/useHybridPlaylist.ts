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

  // Load ALL categories first for immediate display
  const loadAllCategories = useCallback(async (): Promise<string[]> => {
    const { data: categories, error } = await supabase
      .from('m3u_sync_entries')
      .select('group_title')
      .order('group_title', { ascending: true });
    
    if (error || !categories) return [];
    
    // Get unique categories
    const uniqueCategories = [...new Set(categories.map(c => c.group_title || 'Geral'))];
    console.log(`[Hybrid] Found ${uniqueCategories.length} unique categories`);
    return uniqueCategories;
  }, []);

  // Load content by category to ensure all categories are shown from start
  const loadContentByCategory = useCallback(async (categoryNames: string[]): Promise<boolean> => {
    try {
      const allChannels: LightChannel[] = [];
      let globalSeq = 0;
      
      // Process categories in batches of 5 for parallel loading
      const CATEGORY_BATCH_SIZE = 5;
      const categoryBatches = [];
      
      for (let i = 0; i < categoryNames.length; i += CATEGORY_BATCH_SIZE) {
        categoryBatches.push(categoryNames.slice(i, i + CATEGORY_BATCH_SIZE));
      }
      
      for (let batchIdx = 0; batchIdx < categoryBatches.length; batchIdx++) {
        const batch = categoryBatches[batchIdx];
        
        setLoadingProgress(`Carregando categorias (${batchIdx * CATEGORY_BATCH_SIZE + batch.length}/${categoryNames.length})...`);
        
        // Load all categories in this batch in parallel
        const batchPromises = batch.map(async (catName) => {
          const { data: channels, error } = await supabase
            .from('m3u_sync_entries')
            .select('id, title, tvg_logo, group_title')
            .eq('group_title', catName)
            .order('title', { ascending: true });
          
          if (error || !channels) return [];
          
          return channels.map((ch) => ({
            id: ch.id,
            name: ch.title || 'Canal',
            logo: ch.tvg_logo,
            cat: ch.group_title || 'Geral',
            seq: 0,
          }));
        });
        
        const batchResults = await Promise.all(batchPromises);
        
        // Add all channels from this batch
        batchResults.forEach(channels => {
          channels.forEach(ch => {
            ch.seq = globalSeq++;
            allChannels.push(ch);
          });
        });
        
        // Update state after each batch of categories
        allChannelsRef.current = [...allChannels];
        setLoadedChannels(allChannels.length);
        setCategories(groupChannels([...allChannels]));
        
        console.log(`[Hybrid] Loaded ${allChannels.length} channels from ${(batchIdx + 1) * CATEGORY_BATCH_SIZE} categories`);
        
        // Small delay to not block UI
        if (batchIdx < categoryBatches.length - 1) {
          await new Promise(r => setTimeout(r, 30));
        }
      }
      
      setLoadingProgress('');
      console.log(`[Hybrid] Complete: ${allChannels.length} channels in ${categoryNames.length} categories`);
      return true;
    } catch (error) {
      console.error('[Hybrid] loadContentByCategory error:', error);
      return false;
    }
  }, [groupChannels]);

  // Fallback: Load directly from database - loads ALL content by category
  const loadFromDatabase = useCallback(async (): Promise<boolean> => {
    try {
      setLoadingProgress('Carregando catálogo...');
      
      // Get total count first
      const { count: totalCount } = await supabase
        .from('m3u_sync_entries')
        .select('id', { count: 'exact', head: true });
      
      const total = totalCount || 0;
      setTotalChannels(total);
      
      if (total === 0) {
        console.log('[Hybrid] No entries in database');
        return false;
      }

      console.log(`[Hybrid] Total entries: ${total}`);
      setHasPlaylist(true);

      // First, load all unique category names
      const categoryNames = await loadAllCategories();
      
      if (categoryNames.length === 0) {
        console.log('[Hybrid] No categories found');
        return false;
      }

      // Initialize empty categories structure for immediate display
      const emptyCategories: Category[] = categoryNames.map((name, idx) => ({
        id: `cat-${idx}`,
        name,
        display_name: name,
        icon: null,
        channels: [],
      }));
      setCategories(emptyCategories);

      // Load content by category (ensures all categories show from start)
      await loadContentByCategory(categoryNames);
      
      return true;
    } catch (error) {
      console.error('[Hybrid] DB load error:', error);
      return false;
    }
  }, [loadAllCategories, loadContentByCategory]);

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