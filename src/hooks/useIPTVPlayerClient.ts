/**
 * ============================================================================
 * IPTV Player Client Hook - Optimized v2
 * ============================================================================
 * 
 * Uses new playlist-serve endpoint with database-backed caching and ETag support
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface Channel {
  id: string;
  name: string;
  stream_url: string;
  tvg_logo: string | null;
  tvg_id: string | null;
  category_id: string;
  category_name?: string;
  order_position: number;
}

interface Category {
  id: string;
  name: string;
  display_name: string;
  icon: string | null;
  channels: Channel[];
}

interface AssignedPlaylist {
  id: string;
  name: string;
  cdn_url: string | null;
}

interface CachedPlaylist {
  key: string;
  channels: any[];
  version: number;
  cachedAt: number;
  total: number;
  complete: boolean;
}

// ============================================================================
// CONFIGURATION
// ============================================================================
const CONFIG = {
  INITIAL_BATCH_SIZE: 2000,
  BACKGROUND_BATCH_SIZE: 3000,
  PARALLEL_BATCHES: 3,
  MAX_RETRIES: 3,
  CACHE_TTL_MS: 60 * 60 * 1000, // 1 hour
  DB_NAME: 'iptv_playlist_v3',
  DB_VERSION: 1,
  STORE_NAME: 'playlists',
};

// ============================================================================
// INDEXEDDB CACHE
// ============================================================================
class PlaylistCache {
  private db: IDBDatabase | null = null;
  private dbPromise: Promise<IDBDatabase> | null = null;

  async getDB(): Promise<IDBDatabase> {
    if (this.db) return this.db;
    if (this.dbPromise) return this.dbPromise;

    this.dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(CONFIG.DB_NAME, CONFIG.DB_VERSION);
      
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve(this.db);
      };
      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(CONFIG.STORE_NAME)) {
          db.createObjectStore(CONFIG.STORE_NAME, { keyPath: 'key' });
        }
      };
    });

    return this.dbPromise;
  }

  async get(key: string): Promise<CachedPlaylist | null> {
    try {
      const db = await this.getDB();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(CONFIG.STORE_NAME, 'readonly');
        const request = tx.objectStore(CONFIG.STORE_NAME).get(key);
        request.onsuccess = () => {
          const result = request.result;
          if (!result) return resolve(null);
          
          // Check if expired
          if (Date.now() - result.cachedAt > CONFIG.CACHE_TTL_MS) {
            console.log('[Cache] Expired, will refresh');
            return resolve(null);
          }
          
          resolve(result);
        };
        request.onerror = () => reject(request.error);
      });
    } catch (err) {
      console.error('[Cache] Get error:', err);
      return null;
    }
  }

  async save(playlist: CachedPlaylist): Promise<void> {
    try {
      const db = await this.getDB();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(CONFIG.STORE_NAME, 'readwrite');
        const request = tx.objectStore(CONFIG.STORE_NAME).put(playlist);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
    } catch (err) {
      console.error('[Cache] Save error:', err);
    }
  }

  async clear(key: string): Promise<void> {
    try {
      const db = await this.getDB();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(CONFIG.STORE_NAME, 'readwrite');
        const request = tx.objectStore(CONFIG.STORE_NAME).delete(key);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
    } catch (err) {
      console.error('[Cache] Clear error:', err);
    }
  }

  async clearAll(): Promise<void> {
    try {
      const db = await this.getDB();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(CONFIG.STORE_NAME, 'readwrite');
        const request = tx.objectStore(CONFIG.STORE_NAME).clear();
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
    } catch (err) {
      console.error('[Cache] ClearAll error:', err);
    }
  }
}

const cache = new PlaylistCache();

// ============================================================================
// MAIN HOOK
// ============================================================================
export function useIPTVPlayerClient() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [currentChannel, setCurrentChannel] = useState<Channel | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [assignedPlaylist, setAssignedPlaylist] = useState<AssignedPlaylist | null>(null);
  const [loadingProgress, setLoadingProgress] = useState<string>('');
  const [totalChannels, setTotalChannels] = useState(0);
  const [loadedChannels, setLoadedChannels] = useState(0);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasPlaylist, setHasPlaylist] = useState<boolean | null>(null);
  const [isCached, setIsCached] = useState(false);
  
  const abortControllerRef = useRef<AbortController | null>(null);
  const allChannelsRef = useRef<any[]>([]);
  const playlistKeyRef = useRef<string>('');

  // Group channels into categories
  const groupChannelsIntoCategories = useCallback((channels: any[]): Category[] => {
    const categoriesMap = new Map<string, Category>();

    for (const channel of channels) {
      const categoryName = channel.category_name || channel.group_title || 'Sem Categoria';
      
      if (!categoriesMap.has(categoryName)) {
        categoriesMap.set(categoryName, {
          id: `cat-${categoriesMap.size}`,
          name: categoryName,
          display_name: categoryName,
          icon: null,
          channels: []
        });
      }
      
      const category = categoriesMap.get(categoryName)!;
      category.channels.push({
        id: channel.id || channel.entry_hash,
        name: channel.name || channel.title,
        stream_url: channel.stream_url,
        tvg_logo: channel.tvg_logo,
        tvg_id: channel.tvg_id || null,
        category_id: category.id,
        category_name: categoryName,
        order_position: channel.sequence || category.channels.length
      });
    }

    return Array.from(categoriesMap.values());
  }, []);

  // Fetch batch from playlist-serve or fetch-m3u-url
  const fetchBatch = async (
    url: string, 
    offset: number, 
    limit: number,
    signal: AbortSignal,
    useNewApi = false
  ): Promise<{ channels: any[]; total: number; hasMore: boolean; version: number }> => {
    const endpoint = useNewApi 
      ? `https://sdvyxdghxqmntyoweqbd.supabase.co/functions/v1/playlist-serve/playlist/${playlistKeyRef.current}`
      : 'https://sdvyxdghxqmntyoweqbd.supabase.co/functions/v1/fetch-m3u-url';
    
    const session = await supabase.auth.getSession();
    const token = session.data.session?.access_token || '';
    
    for (let attempt = 0; attempt < CONFIG.MAX_RETRIES; attempt++) {
      try {
        let response: Response;
        
        if (useNewApi) {
          // New playlist-serve API (GET with query params)
          const params = new URLSearchParams({ offset: String(offset), limit: String(limit) });
          response = await fetch(`${endpoint}?${params}`, {
            headers: { 'Authorization': `Bearer ${token}` },
            signal,
          });
        } else {
          // Old fetch-m3u-url API (POST with body)
          response = await fetch(endpoint, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`,
            },
            body: JSON.stringify({ url, limit, offset }),
            signal,
          });
        }

        if (!response.ok) throw new Error(`HTTP ${response.status}`);

        const data = await response.json();
        
        // Handle server retry request
        if (data.partial && data.retryAfter && data.channels?.length === 0) {
          console.log(`[IPTV] Server building cache, waiting ${data.retryAfter}s...`);
          await new Promise(r => setTimeout(r, data.retryAfter * 1000));
          continue;
        }

        return {
          channels: data.channels || [],
          total: data.total || 0,
          hasMore: data.hasMore ?? false,
          version: data.version || 0,
        };
      } catch (err: any) {
        if (err.name === 'AbortError') throw err;
        console.error(`[IPTV] Fetch attempt ${attempt + 1} failed:`, err);
        await new Promise(r => setTimeout(r, 2000 * (attempt + 1)));
      }
    }

    throw new Error('Failed to fetch after retries');
  };

  // Load all channels with parallel batching
  const loadAllChannelsParallel = useCallback(async (
    url: string,
    total: number,
    initialChannels: any[],
    version: number
  ) => {
    const controller = new AbortController();
    abortControllerRef.current = controller;
    
    let currentOffset = initialChannels.length;
    
    console.log(`[IPTV] Loading ${total - currentOffset} remaining channels...`);
    
    while (currentOffset < total && !controller.signal.aborted) {
      const batchPromises: Promise<{ channels: any[]; offset: number }>[] = [];
      
      for (let i = 0; i < CONFIG.PARALLEL_BATCHES && currentOffset + (i * CONFIG.BACKGROUND_BATCH_SIZE) < total; i++) {
        const batchOffset = currentOffset + (i * CONFIG.BACKGROUND_BATCH_SIZE);
        
        batchPromises.push(
          fetchBatch(url, batchOffset, CONFIG.BACKGROUND_BATCH_SIZE, controller.signal)
            .then(result => ({ channels: result.channels, offset: batchOffset }))
            .catch(() => ({ channels: [], offset: batchOffset }))
        );
      }

      if (batchPromises.length === 0) break;

      const results = await Promise.all(batchPromises);
      results.sort((a, b) => a.offset - b.offset);
      
      let newCount = 0;
      for (const result of results) {
        if (result.channels.length > 0) {
          allChannelsRef.current = [...allChannelsRef.current, ...result.channels];
          newCount += result.channels.length;
        }
      }

      if (newCount === 0) break;

      currentOffset += CONFIG.PARALLEL_BATCHES * CONFIG.BACKGROUND_BATCH_SIZE;
      
      setLoadedChannels(allChannelsRef.current.length);
      setLoadingProgress(`Carregando: ${allChannelsRef.current.length.toLocaleString()}/${total.toLocaleString()}`);
      
      const updatedCategories = groupChannelsIntoCategories(allChannelsRef.current);
      setCategories(updatedCategories);

      // Save to cache every 10k channels
      if (allChannelsRef.current.length % 10000 < CONFIG.BACKGROUND_BATCH_SIZE) {
        await cache.save({
          key: playlistKeyRef.current,
          channels: allChannelsRef.current,
          version,
          cachedAt: Date.now(),
          total,
          complete: false,
        });
      }
    }

    // Final save
    if (!controller.signal.aborted && allChannelsRef.current.length > 0) {
      await cache.save({
        key: playlistKeyRef.current,
        channels: allChannelsRef.current,
        version,
        cachedAt: Date.now(),
        total: allChannelsRef.current.length,
        complete: true,
      });
      
      setCategories(groupChannelsIntoCategories(allChannelsRef.current));
      setLoadedChannels(allChannelsRef.current.length);
      setIsLoadingMore(false);
      setLoadingProgress('');
      
      console.log(`[IPTV] Complete: ${allChannelsRef.current.length} channels cached`);
    }
  }, [groupChannelsIntoCategories]);

  // Load playlist from CDN URL
  const loadPlaylistFromCDN = useCallback(async (cdnUrl: string, playlistId: string) => {
    playlistKeyRef.current = playlistId;
    
    try {
      setLoadingProgress('Verificando cache...');
      
      // Check local cache
      const cached = await cache.get(playlistId);
      
      if (cached && cached.channels.length > 0) {
        console.log(`[IPTV] Cache hit: ${cached.channels.length} channels`);
        
        allChannelsRef.current = cached.channels;
        setTotalChannels(cached.total);
        setLoadedChannels(cached.channels.length);
        setIsCached(true);
        
        const cats = groupChannelsIntoCategories(cached.channels);
        setCategories(cats);
        
        if (cats.length > 0 && cats[0].channels.length > 0) {
          setCurrentChannel(cats[0].channels[0]);
        }
        
        setIsLoading(false);
        setLoadingProgress('');
        
        // Continue loading if incomplete
        if (!cached.complete && cached.channels.length < cached.total) {
          setIsLoadingMore(true);
          loadAllChannelsParallel(cdnUrl, cached.total, cached.channels, cached.version);
        }
        
        return;
      }
      
      // No cache - fetch from server
      setLoadingProgress('Carregando canais...');
      setIsCached(false);
      
      const controller = new AbortController();
      const { channels, total, version } = await fetchBatch(
        cdnUrl,
        0,
        CONFIG.INITIAL_BATCH_SIZE,
        controller.signal
      );
      
      setTotalChannels(total);
      setLoadedChannels(channels.length);
      allChannelsRef.current = channels;
      
      const cats = groupChannelsIntoCategories(channels);
      setCategories(cats);
      
      if (cats.length > 0 && cats[0].channels.length > 0) {
        setCurrentChannel(cats[0].channels[0]);
      }
      
      setIsLoading(false);
      
      console.log(`[IPTV] First batch: ${channels.length}/${total}`);
      
      // Save to cache
      await cache.save({
        key: playlistId,
        channels,
        version,
        cachedAt: Date.now(),
        total,
        complete: channels.length >= total,
      });
      
      if (channels.length < total) {
        setLoadingProgress(`Carregando: ${channels.length.toLocaleString()}/${total.toLocaleString()}`);
        setIsLoadingMore(true);
        loadAllChannelsParallel(cdnUrl, total, channels, version);
      } else {
        setLoadingProgress('');
      }

    } catch (err: any) {
      console.error('[IPTV] Error loading:', err);
      throw err;
    }
  }, [groupChannelsIntoCategories, loadAllChannelsParallel]);

  // Load from database
  const loadPlaylistFromDatabase = useCallback(async (customListId: string) => {
    playlistKeyRef.current = customListId;
    
    try {
      setLoadingProgress('Carregando categorias...');

      const { data: categoriesData, error: categoriesError } = await supabase
        .from('m3u_categories')
        .select('*')
        .eq('custom_list_id', customListId)
        .order('order_position');

      if (categoriesError) throw categoriesError;

      if (!categoriesData?.length) {
        setCategories([]);
        setIsLoading(false);
        return;
      }

      setLoadingProgress('Carregando canais...');

      const { data: channelsData, error: channelsError } = await supabase
        .from('m3u_channels')
        .select('*, m3u_categories(name, display_name)')
        .in('category_id', categoriesData.map(c => c.id))
        .order('order_position');

      if (channelsError) throw channelsError;

      const catsWithChannels: Category[] = categoriesData.map(cat => ({
        id: cat.id,
        name: cat.name,
        display_name: cat.display_name,
        icon: cat.icon,
        channels: (channelsData || [])
          .filter(ch => ch.category_id === cat.id)
          .map(ch => ({
            id: ch.id,
            name: ch.name,
            stream_url: ch.stream_url,
            tvg_logo: ch.tvg_logo,
            tvg_id: ch.tvg_id,
            category_id: ch.category_id,
            category_name: (ch.m3u_categories as any)?.display_name,
            order_position: ch.order_position || 0
          }))
      }));

      setCategories(catsWithChannels);
      setTotalChannels(channelsData?.length || 0);
      setLoadedChannels(channelsData?.length || 0);

      if (catsWithChannels.length > 0 && catsWithChannels[0].channels.length > 0) {
        setCurrentChannel(catsWithChannels[0].channels[0]);
      }

      setIsLoading(false);
      setLoadingProgress('');

    } catch (err) {
      console.error('[IPTV] Database load error:', err);
      throw err;
    }
  }, []);

  // Main loader
  const loadClientPlaylist = useCallback(async () => {
    try {
      setIsLoading(true);
      setLoadingProgress('Verificando playlist...');
      setCategories([]);
      setTotalChannels(0);
      setLoadedChannels(0);
      allChannelsRef.current = [];

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error('Usuário não autenticado');
        setIsLoading(false);
        setHasPlaylist(false);
        return;
      }

      const { data: cliente } = await supabase
        .from('clientes')
        .select('id')
        .eq('user_id', user.id)
        .single();

      if (!cliente) {
        setIsLoading(false);
        setHasPlaylist(false);
        return;
      }

      // Try custom list first
      const { data: customAssignment } = await supabase
        .from('client_m3u_custom_assignments')
        .select(`
          custom_list_id,
          m3u_custom_lists (id, name, cdn_url, status)
        `)
        .eq('cliente_id', cliente.id)
        .maybeSingle();

      if (customAssignment?.m3u_custom_lists) {
        const list = customAssignment.m3u_custom_lists as any;
        
        if (list.status === 'active') {
          setAssignedPlaylist({ id: list.id, name: list.name, cdn_url: list.cdn_url });
          setHasPlaylist(true);

          if (list.cdn_url) {
            await loadPlaylistFromCDN(list.cdn_url, list.id);
          } else {
            await loadPlaylistFromDatabase(list.id);
          }
          return;
        }
      }

      // Fallback: traditional M3U list
      const { data: traditionalAssignment } = await supabase
        .from('client_m3u_lists')
        .select(`
          m3u_list_id, is_active,
          m3u_lists (id, name, file_url, status)
        `)
        .eq('client_id', cliente.id)
        .eq('is_active', true)
        .limit(1)
        .maybeSingle();

      if (traditionalAssignment?.m3u_lists) {
        const list = traditionalAssignment.m3u_lists as any;
        
        if (list.status === 'active' && list.file_url) {
          setAssignedPlaylist({ id: list.id, name: list.name, cdn_url: list.file_url });
          setHasPlaylist(true);
          await loadPlaylistFromCDN(list.file_url, list.id);
          return;
        }
      }

      setIsLoading(false);
      setHasPlaylist(false);

    } catch (err) {
      console.error('[IPTV] Load error:', err);
      toast.error('Erro ao carregar playlist');
      setIsLoading(false);
      setHasPlaylist(false);
    }
  }, [loadPlaylistFromCDN, loadPlaylistFromDatabase]);

  // Clear cache and reload
  const clearCacheAndReload = useCallback(async () => {
    if (playlistKeyRef.current) {
      await cache.clear(playlistKeyRef.current);
    }
    setIsCached(false);
    loadClientPlaylist();
  }, [loadClientPlaylist]);

  // Initial load
  useEffect(() => {
    loadClientPlaylist();
    
    return () => {
      abortControllerRef.current?.abort();
    };
  }, []);

  // Channel navigation
  const changeChannel = useCallback((channel: Channel) => {
    setCurrentChannel(channel);
  }, []);

  const nextChannel = useCallback(() => {
    if (!currentChannel) return;
    const all = categories.flatMap(cat => cat.channels);
    const idx = all.findIndex(ch => ch.id === currentChannel.id);
    if (idx < all.length - 1) setCurrentChannel(all[idx + 1]);
  }, [currentChannel, categories]);

  const previousChannel = useCallback(() => {
    if (!currentChannel) return;
    const all = categories.flatMap(cat => cat.channels);
    const idx = all.findIndex(ch => ch.id === currentChannel.id);
    if (idx > 0) setCurrentChannel(all[idx - 1]);
  }, [currentChannel, categories]);

  return {
    categories,
    currentChannel,
    isLoading,
    loadingProgress,
    assignedPlaylist,
    hasPlaylist,
    totalChannels,
    loadedChannels,
    isLoadingMore,
    isCached,
    changeChannel,
    nextChannel,
    previousChannel,
    refreshPlaylist: loadClientPlaylist,
    clearCacheAndReload,
  };
}
