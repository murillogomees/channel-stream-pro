/**
 * ============================================================================
 * IPTV Player Client Hook - Optimized v4
 * ============================================================================
 * 
 * Fixed background loading - continues until all content is loaded
 * Removed toasts for cleaner UX
 */

import { useState, useEffect, useCallback, useRef, startTransition } from 'react';
import { supabase } from '@/integrations/supabase/client';

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
  INITIAL_BATCH_SIZE: 3000,
  BACKGROUND_BATCH_SIZE: 3000,
  PARALLEL_BATCHES: 4,
  MAX_RETRIES: 5,
  MAX_CONSECUTIVE_ERRORS: 10, // Only stop on actual errors, not retry requests
  CACHE_TTL_MS: 2 * 60 * 60 * 1000, // 2 hours
  DB_NAME: 'iptv_playlist_v4',
  DB_VERSION: 1,
  STORE_NAME: 'playlists',
  BATCH_DELAY_MS: 200, // Delay between batch groups
  RETRY_DELAY_MS: 2000, // Delay when server requests retry
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
  const playlistUrlRef = useRef<string>('');

  // Group channels into categories - optimized with startTransition
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
        id: channel.id || channel.entry_hash || `ch-${category.channels.length}`,
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

  // Update UI without blocking
  const updateUIInBackground = useCallback((channels: any[], total: number, progress?: string) => {
    startTransition(() => {
      setLoadedChannels(channels.length);
      if (progress) setLoadingProgress(progress);
      setCategories(groupChannelsIntoCategories(channels));
    });
  }, [groupChannelsIntoCategories]);

  // Fetch batch with improved retry and error handling
  const fetchBatch = async (
    url: string, 
    offset: number, 
    limit: number,
    signal: AbortSignal
  ): Promise<{ channels: any[]; total: number; hasMore: boolean; version: number; shouldRetry?: boolean }> => {
    const session = await supabase.auth.getSession();
    const token = session.data.session?.access_token || '';
    
    for (let attempt = 0; attempt < CONFIG.MAX_RETRIES; attempt++) {
      try {
        const response = await fetch('https://sdvyxdghxqmntyoweqbd.supabase.co/functions/v1/fetch-m3u-url', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify({ url, limit, offset }),
          signal,
        });

        if (!response.ok) throw new Error(`HTTP ${response.status}`);

        const data = await response.json();
        
        // Handle server retry request (server is building cache)
        if (data.partial && data.retryAfter && data.channels?.length === 0) {
          console.log(`[IPTV] Server building cache for offset ${offset}, waiting ${data.retryAfter}s...`);
          await new Promise(r => setTimeout(r, data.retryAfter * 1000));
          continue; // Retry the same request
        }

        return {
          channels: data.channels || [],
          total: data.total || 0,
          hasMore: data.hasMore ?? (data.partial === true),
          version: data.version || 0,
          shouldRetry: data.partial && data.channels?.length === 0,
        };
      } catch (err: any) {
        if (err.name === 'AbortError') throw err;
        console.error(`[IPTV] Fetch attempt ${attempt + 1} failed:`, err.message);
        if (attempt < CONFIG.MAX_RETRIES - 1) {
          await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));
        }
      }
    }

    // Return with shouldRetry flag to indicate we should try again later
    return { channels: [], total: 0, hasMore: true, version: 0, shouldRetry: true };
  };

  // Background loading - continues until all content is truly loaded
  const loadAllChannelsBackground = useCallback(async (
    url: string,
    estimatedTotal: number,
    initialChannels: any[],
    version: number
  ) => {
    const controller = new AbortController();
    abortControllerRef.current = controller;
    
    let currentOffset = initialChannels.length;
    let consecutiveErrors = 0;
    let actualTotal = estimatedTotal;
    let lastProgress = currentOffset;
    
    console.log(`[IPTV] Background loading from offset ${currentOffset}, estimated total: ${estimatedTotal}...`);
    
    while (!controller.signal.aborted) {
      // Stop if we've had too many consecutive errors
      if (consecutiveErrors >= CONFIG.MAX_CONSECUTIVE_ERRORS) {
        console.log(`[IPTV] Stopping: ${consecutiveErrors} consecutive errors`);
        break;
      }
      
      // Stop if we've loaded more than the estimated total and no new channels for a while
      if (allChannelsRef.current.length >= actualTotal && lastProgress === allChannelsRef.current.length) {
        console.log(`[IPTV] Reached estimated total: ${allChannelsRef.current.length}`);
        break;
      }
      
      const batchPromises: Promise<{ channels: any[]; offset: number; hasMore: boolean; shouldRetry?: boolean }>[] = [];
      
      for (let i = 0; i < CONFIG.PARALLEL_BATCHES; i++) {
        const batchOffset = currentOffset + (i * CONFIG.BACKGROUND_BATCH_SIZE);
        
        batchPromises.push(
          fetchBatch(url, batchOffset, CONFIG.BACKGROUND_BATCH_SIZE, controller.signal)
            .then(result => ({ 
              channels: result.channels, 
              offset: batchOffset,
              hasMore: result.hasMore,
              shouldRetry: result.shouldRetry,
            }))
            .catch(() => ({ channels: [], offset: batchOffset, hasMore: true, shouldRetry: true }))
        );
      }

      const results = await Promise.all(batchPromises);
      results.sort((a, b) => a.offset - b.offset);
      
      let batchNewCount = 0;
      let anyHasMore = false;
      let anyNeedsRetry = false;
      
      for (const result of results) {
        if (result.channels.length > 0) {
          allChannelsRef.current = [...allChannelsRef.current, ...result.channels];
          batchNewCount += result.channels.length;
          consecutiveErrors = 0; // Reset error counter on success
        }
        if (result.hasMore) anyHasMore = true;
        if (result.shouldRetry) anyNeedsRetry = true;
      }

      // Update progress tracking
      lastProgress = allChannelsRef.current.length;
      
      if (batchNewCount === 0) {
        if (anyNeedsRetry) {
          // Server is building cache, wait and retry same offsets
          console.log(`[IPTV] Server building cache, waiting ${CONFIG.RETRY_DELAY_MS}ms...`);
          await new Promise(r => setTimeout(r, CONFIG.RETRY_DELAY_MS));
          continue; // Don't advance offset, retry
        } else if (!anyHasMore) {
          // Server says no more data
          console.log('[IPTV] Server indicates no more data');
          break;
        } else {
          consecutiveErrors++;
          console.log(`[IPTV] Empty batch group #${consecutiveErrors}`);
        }
      }

      // Only advance offset if we got data or server confirmed no retry needed
      if (batchNewCount > 0 || !anyNeedsRetry) {
        currentOffset += CONFIG.PARALLEL_BATCHES * CONFIG.BACKGROUND_BATCH_SIZE;
      }
      
      // Update actual total based on loaded content
      actualTotal = Math.max(actualTotal, allChannelsRef.current.length);
      
      // Update UI in background (non-blocking)
      updateUIInBackground(
        allChannelsRef.current, 
        actualTotal,
        `Carregando: ${allChannelsRef.current.length.toLocaleString()} canais`
      );

      // Save to cache every 15k channels
      if (allChannelsRef.current.length % 15000 < CONFIG.BACKGROUND_BATCH_SIZE * CONFIG.PARALLEL_BATCHES) {
        await cache.save({
          key: playlistKeyRef.current,
          channels: allChannelsRef.current,
          version,
          cachedAt: Date.now(),
          total: actualTotal,
          complete: false,
        });
      }

      // Delay between batch groups
      await new Promise(r => setTimeout(r, CONFIG.BATCH_DELAY_MS));
    }

    // Final update and save
    if (!controller.signal.aborted && allChannelsRef.current.length > 0) {
      const finalTotal = allChannelsRef.current.length;
      
      await cache.save({
        key: playlistKeyRef.current,
        channels: allChannelsRef.current,
        version,
        cachedAt: Date.now(),
        total: finalTotal,
        complete: true,
      });
      
      startTransition(() => {
        setCategories(groupChannelsIntoCategories(allChannelsRef.current));
        setTotalChannels(finalTotal);
        setLoadedChannels(finalTotal);
        setIsLoadingMore(false);
        setLoadingProgress('');
      });
      
      console.log(`[IPTV] Background loading complete: ${finalTotal} channels`);
    }
  }, [groupChannelsIntoCategories, updateUIInBackground]);

  // Load playlist from M3U URL
  const loadPlaylistFromURL = useCallback(async (url: string, playlistId: string, playlistName: string) => {
    playlistKeyRef.current = playlistId;
    playlistUrlRef.current = url;
    
    try {
      setLoadingProgress('Verificando cache...');
      
      // Check local cache first
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
        
        setAssignedPlaylist({ id: playlistId, name: playlistName, cdn_url: url });
        setHasPlaylist(true);
        setIsLoading(false);
        setLoadingProgress('');
        
        // Continue loading if incomplete
        if (!cached.complete) {
          setIsLoadingMore(true);
          loadAllChannelsBackground(url, cached.total, cached.channels, cached.version);
        }
        
        return true;
      }
      
      // No cache - fetch initial batch
      setLoadingProgress('Carregando canais...');
      setIsCached(false);
      
      const controller = new AbortController();
      const { channels, total, version, hasMore } = await fetchBatch(
        url,
        0,
        CONFIG.INITIAL_BATCH_SIZE,
        controller.signal
      );
      
      if (channels.length === 0) {
        console.log('[IPTV] No channels returned from initial batch');
        return false;
      }
      
      // Use estimated total, or fall back to a large number if server doesn't know
      const estimatedTotal = total > 0 ? total : 200000;
      
      setTotalChannels(estimatedTotal);
      setLoadedChannels(channels.length);
      allChannelsRef.current = channels;
      
      const cats = groupChannelsIntoCategories(channels);
      setCategories(cats);
      
      if (cats.length > 0 && cats[0].channels.length > 0) {
        setCurrentChannel(cats[0].channels[0]);
      }
      
      setAssignedPlaylist({ id: playlistId, name: playlistName, cdn_url: url });
      setHasPlaylist(true);
      setIsLoading(false);
      
      console.log(`[IPTV] Initial batch: ${channels.length} channels, estimated total: ${estimatedTotal}`);
      
      // Save initial batch to cache
      await cache.save({
        key: playlistId,
        channels,
        version,
        cachedAt: Date.now(),
        total: estimatedTotal,
        complete: !hasMore && channels.length >= estimatedTotal,
      });
      
      // Start background loading if there's more
      if (hasMore || channels.length < estimatedTotal) {
        setLoadingProgress(`Carregando: ${channels.length.toLocaleString()} canais`);
        setIsLoadingMore(true);
        loadAllChannelsBackground(url, estimatedTotal, channels, version);
      } else {
        setLoadingProgress('');
      }
      
      return true;

    } catch (err: any) {
      console.error('[IPTV] Error loading from URL:', err);
      return false;
    }
  }, [groupChannelsIntoCategories, loadAllChannelsBackground]);

  // Load from playlist-serve (new pipeline)
  const loadFromPlaylistServe = useCallback(async (playlistKey: string) => {
    playlistKeyRef.current = playlistKey;
    
    try {
      setLoadingProgress('Verificando playlist...');
      
      const endpoint = `https://sdvyxdghxqmntyoweqbd.supabase.co/functions/v1/playlist-serve/playlist/${playlistKey}`;
      const params = new URLSearchParams({ offset: '0', limit: String(CONFIG.INITIAL_BATCH_SIZE) });
      
      const response = await fetch(`${endpoint}?${params}`);
      if (!response.ok) {
        console.log(`[IPTV] playlist-serve returned ${response.status}`);
        return false;
      }
      
      const data = await response.json();
      
      if (!data.channels || data.channels.length === 0) {
        console.log('[IPTV] No channels in playlist-serve');
        return false;
      }
      
      console.log(`[IPTV] playlist-serve has ${data.total} entries`);
      
      // If playlist-serve has data, use it
      setTotalChannels(data.total);
      setLoadedChannels(data.channels.length);
      allChannelsRef.current = data.channels;
      
      const cats = groupChannelsIntoCategories(data.channels);
      setCategories(cats);
      
      if (cats.length > 0 && cats[0].channels.length > 0) {
        setCurrentChannel(cats[0].channels[0]);
      }
      
      setAssignedPlaylist({ id: playlistKey, name: 'Lista VIP', cdn_url: null });
      setHasPlaylist(true);
      setIsLoading(false);
      
      // Continue loading in background if needed
      if (data.hasMore) {
        setIsLoadingMore(true);
        setLoadingProgress(`Carregando: ${data.channels.length.toLocaleString()}/${data.total.toLocaleString()}`);
        
        // Background load remaining from playlist-serve
        loadPlaylistServeBackground(playlistKey, data.total, data.channels, data.version || 1);
      } else {
        setLoadingProgress('');
      }
      
      return true;
      
    } catch (err: any) {
      console.error('[IPTV] playlist-serve error:', err);
      return false;
    }
  }, [groupChannelsIntoCategories]);

  // Background loader for playlist-serve
  const loadPlaylistServeBackground = useCallback(async (
    playlistKey: string,
    total: number,
    initialChannels: any[],
    version: number
  ) => {
    const controller = new AbortController();
    abortControllerRef.current = controller;
    
    let currentOffset = initialChannels.length;
    const endpoint = `https://sdvyxdghxqmntyoweqbd.supabase.co/functions/v1/playlist-serve/playlist/${playlistKey}`;
    
    while (currentOffset < total && !controller.signal.aborted) {
      const batchPromises: Promise<{ channels: any[]; offset: number }>[] = [];
      
      for (let i = 0; i < CONFIG.PARALLEL_BATCHES && currentOffset + (i * CONFIG.BACKGROUND_BATCH_SIZE) < total; i++) {
        const batchOffset = currentOffset + (i * CONFIG.BACKGROUND_BATCH_SIZE);
        const params = new URLSearchParams({ 
          offset: String(batchOffset), 
          limit: String(CONFIG.BACKGROUND_BATCH_SIZE) 
        });
        
        batchPromises.push(
          fetch(`${endpoint}?${params}`, { signal: controller.signal })
            .then(r => r.json())
            .then(data => ({ channels: data.channels || [], offset: batchOffset }))
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
      
      updateUIInBackground(
        allChannelsRef.current,
        total,
        `Carregando: ${allChannelsRef.current.length.toLocaleString()}/${total.toLocaleString()}`
      );

      await new Promise(r => setTimeout(r, CONFIG.BATCH_DELAY_MS));
    }

    // Final update
    if (!controller.signal.aborted && allChannelsRef.current.length > 0) {
      startTransition(() => {
        setCategories(groupChannelsIntoCategories(allChannelsRef.current));
        setLoadedChannels(allChannelsRef.current.length);
        setIsLoadingMore(false);
        setLoadingProgress('');
      });
      
      console.log(`[IPTV] playlist-serve complete: ${allChannelsRef.current.length} channels`);
    }
  }, [groupChannelsIntoCategories, updateUIInBackground]);

  // Load from database (custom lists)
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
        return false;
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
      
      return true;

    } catch (err) {
      console.error('[IPTV] Database load error:', err);
      return false;
    }
  }, []);

  // Main loader - prioritizes user's assigned playlist
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
        console.error('[IPTV] User not authenticated');
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

      // 1. Try traditional M3U list first (most common case)
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
          console.log(`[IPTV] Found assigned M3U list: ${list.name}`);
          const success = await loadPlaylistFromURL(list.file_url, list.id, list.name);
          if (success) return;
        }
      }

      // 2. Try custom list
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
          console.log(`[IPTV] Found custom list: ${list.name}`);
          setAssignedPlaylist({ id: list.id, name: list.name, cdn_url: list.cdn_url });
          setHasPlaylist(true);

          if (list.cdn_url) {
            const success = await loadPlaylistFromURL(list.cdn_url, list.id, list.name);
            if (success) return;
          } else {
            const success = await loadPlaylistFromDatabase(list.id);
            if (success) return;
          }
        }
      }

      // 3. Try playlist-serve pipeline as fallback
      console.log('[IPTV] Trying playlist-serve pipeline...');
      const usedNewPipeline = await loadFromPlaylistServe('lista-vip');
      if (usedNewPipeline) return;

      setIsLoading(false);
      setHasPlaylist(false);

    } catch (err) {
      console.error('[IPTV] Load error:', err);
      setIsLoading(false);
      setHasPlaylist(false);
    }
  }, [loadPlaylistFromURL, loadPlaylistFromDatabase, loadFromPlaylistServe]);

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

  // Backend search function
  const searchBackend = useCallback(async (
    query: string,
    options?: { category?: string; limit?: number }
  ): Promise<{ channels: any[]; total: number }> => {
    if (!query || query.length < 2) {
      return { channels: [], total: 0 };
    }

    const playlistKey = playlistKeyRef.current || 'lista-vip';
    
    try {
      const session = await supabase.auth.getSession();
      const token = session.data.session?.access_token || '';
      
      const params = new URLSearchParams({
        q: query,
        limit: String(options?.limit || 100),
      });
      
      if (playlistKey) {
        params.append('playlist', playlistKey);
      }
      if (options?.category) {
        params.append('category', options.category);
      }

      const response = await fetch(
        `https://sdvyxdghxqmntyoweqbd.supabase.co/functions/v1/playlist-serve/search?${params}`,
        {
          headers: { 'Authorization': `Bearer ${token}` },
        }
      );

      if (!response.ok) {
        console.error('[Search] HTTP error:', response.status);
        return { channels: [], total: 0 };
      }

      const data = await response.json();
      
      const channels = (data.entries || []).map((entry: any) => ({
        id: entry.id,
        name: entry.title,
        stream_url: entry.stream_url,
        tvg_logo: entry.tvg_logo,
        tvg_id: entry.tvg_id,
        category_id: entry.group_title || 'search',
        category_name: entry.group_title || 'Resultado da busca',
        order_position: 0,
      }));

      return {
        channels,
        total: data.total || channels.length,
      };
    } catch (err) {
      console.error('[Search] Error:', err);
      return { channels: [], total: 0 };
    }
  }, []);

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
    searchBackend,
  };
}
