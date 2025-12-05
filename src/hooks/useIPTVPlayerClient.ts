/**
 * ============================================================================
 * IPTV Player Client Hook - Optimized v5
 * ============================================================================
 * 
 * FIXED: Infinite loop, proper stop conditions, optimized background loading
 */

import { useState, useEffect, useCallback, useRef, startTransition } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { extractMetadata, getStoredStreamUrl, clearStreamUrlIndex } from '@/services/smartPrefetch';

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
  INITIAL_BATCH_SIZE: 10000,    // Increased from 5000 - server supports 50k max
  BACKGROUND_BATCH_SIZE: 10000,
  PARALLEL_BATCHES: 3,
  MAX_RETRIES: 3,
  MAX_RETRY_CYCLES: 5,
  MAX_CONSECUTIVE_EMPTY: 3,
  CACHE_TTL_MS: 24 * 60 * 60 * 1000,  // 24 hours - aggressive caching
  DB_NAME: 'iptv_playlist_v8',         // New version for new batch size
  DB_VERSION: 1,
  STORE_NAME: 'playlists',
  CATEGORIES_STORE: 'categories',
  BATCH_DELAY_MS: 100,
  RETRY_DELAY_MS: 2000,
  PLAYLIST_SERVE_URL: 'https://sdvyxdghxqmntyoweqbd.supabase.co/functions/v1/playlist-serve',
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
  const [loadingPercent, setLoadingPercent] = useState(0);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [isCategoryLoading, setIsCategoryLoading] = useState(false);
  
  const abortControllerRef = useRef<AbortController | null>(null);
  const allChannelsRef = useRef<any[]>([]);
  const playlistKeyRef = useRef<string>('');
  const playlistUrlRef = useRef<string>('');
  const isBackgroundLoadingRef = useRef(false);
  const groupChannelsRef = useRef<(channels: any[]) => Category[]>(() => []);

  // Group channels into categories - stores stream URLs in index, passes only metadata to UI
  groupChannelsRef.current = (channels: any[]): Category[] => {
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
      
      // Extract metadata and store stream URL in index (smart prefetch)
      const metadata = extractMetadata(channel, category.id);
      
      category.channels.push({
        id: metadata.id,
        name: metadata.name,
        stream_url: channel.stream_url, // Keep for backwards compatibility
        tvg_logo: metadata.tvg_logo,
        tvg_id: metadata.tvg_id,
        category_id: category.id,
        category_name: categoryName,
        order_position: metadata.order_position
      });
    }

    return Array.from(categoriesMap.values());
  };

  // Update UI without blocking - with progress percentage
  const updateUIInBackground = useCallback((channels: any[], total: number, progress?: string) => {
    const percent = total > 0 ? Math.round((channels.length / total) * 100) : 0;
    startTransition(() => {
      setLoadedChannels(channels.length);
      setLoadingPercent(percent);
      if (progress) setLoadingProgress(progress);
      setCategories(groupChannelsRef.current(channels));
    });
  }, []);

  // Fetch batch with improved retry
  const fetchBatch = async (
    url: string, 
    offset: number, 
    limit: number,
    signal: AbortSignal
  ): Promise<{ channels: any[]; total: number; hasMore: boolean; version: number }> => {
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
        console.error(`[IPTV] Fetch attempt ${attempt + 1} failed:`, err.message);
        if (attempt < CONFIG.MAX_RETRIES - 1) {
          await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));
        }
      }
    }

    return { channels: [], total: 0, hasMore: false, version: 0 };
  };

  // Background loading - STABLE: NO UI updates during sync, only at END
  const loadAllChannelsBackground = useCallback(async (
    url: string,
    serverTotal: number,
    initialChannels: any[],
    version: number
  ) => {
    if (isBackgroundLoadingRef.current) {
      console.log('[IPTV] Background loading already running');
      return;
    }
    
    const currentOffset = initialChannels.length;
    
    // CRITICAL: Stop immediately if already complete
    if (currentOffset >= serverTotal) {
      console.log(`[IPTV] Already complete: ${currentOffset}/${serverTotal}`);
      setIsLoadingMore(false);
      setLoadingProgress('');
      return;
    }
    
    isBackgroundLoadingRef.current = true;
    
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    
    const controller = new AbortController();
    abortControllerRef.current = controller;
    
    let offset = currentOffset;
    let consecutiveEmptyBatches = 0;
    
    console.log(`[IPTV] Background loading ${offset}/${serverTotal}...`);
    
    // Show simple progress without UI updates
    setLoadingProgress(`Sincronizando em segundo plano...`);
    
    try {
      while (!controller.signal.aborted) {
        // STOP CONDITIONS
        if (offset >= serverTotal) {
          console.log(`[IPTV] Complete: offset ${offset} >= total ${serverTotal}`);
          break;
        }
        
        if (consecutiveEmptyBatches >= CONFIG.MAX_CONSECUTIVE_EMPTY) {
          console.log(`[IPTV] Stopping: ${consecutiveEmptyBatches} empty batches`);
          break;
        }
        
        const result = await fetchBatch(url, offset, CONFIG.BACKGROUND_BATCH_SIZE, controller.signal);
        
        // Empty result handling
        if (result.channels.length === 0) {
          consecutiveEmptyBatches++;
          
          // Server says no more data - stop
          if (!result.hasMore) {
            console.log(`[IPTV] Server says no more data at offset ${offset}`);
            break;
          }
          
          await new Promise(r => setTimeout(r, 500));
          continue;
        }
        
        // Add channels and advance - NO UI UPDATE during sync
        consecutiveEmptyBatches = 0;
        allChannelsRef.current = [...allChannelsRef.current, ...result.channels];
        offset = allChannelsRef.current.length;
        
        // Update loaded count only (no category rebuild)
        setLoadedChannels(offset);
        
        await new Promise(r => setTimeout(r, 50));
      }

      // Final update - ONLY at the very END
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
        
        // Single UI update at the end
        startTransition(() => {
          setCategories(groupChannelsRef.current(allChannelsRef.current));
          setTotalChannels(finalTotal);
          setLoadedChannels(finalTotal);
          setIsLoadingMore(false);
          setLoadingProgress('');
        });
        
        console.log(`[IPTV] Background complete: ${finalTotal} channels`);
      }
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        console.error('[IPTV] Background error:', err.message);
      }
    } finally {
      isBackgroundLoadingRef.current = false;
      setIsLoadingMore(false);
      setLoadingProgress('');
    }
  }, []);

  // Load playlist from M3U URL
  const loadPlaylistFromURL = useCallback(async (url: string, playlistId: string, playlistName: string) => {
    playlistKeyRef.current = playlistId;
    playlistUrlRef.current = url;
    
    try {
      setLoadingProgress('Sincronizando...');
      
      const cached = await cache.get(playlistId);
      
      if (cached && cached.channels.length > 0) {
        console.log(`[IPTV] Cache hit: ${cached.channels.length} channels`);
        
        allChannelsRef.current = cached.channels;
        setTotalChannels(cached.total);
        setLoadedChannels(cached.channels.length);
        setIsCached(true);
        
        const cats = groupChannelsRef.current(cached.channels);
        setCategories(cats);
        
        if (cats.length > 0 && cats[0].channels.length > 0) {
          setCurrentChannel(cats[0].channels[0]);
        }
        
        setAssignedPlaylist({ id: playlistId, name: playlistName, cdn_url: url });
        setHasPlaylist(true);
        setIsLoading(false);
        setLoadingProgress('');
        
        if (!cached.complete) {
          setIsLoadingMore(true);
          loadAllChannelsBackground(url, cached.total, cached.channels, cached.version);
        }
        
        return true;
      }
      
      setLoadingProgress('Sincronizando canais...');
      setIsCached(false);
      
      const controller = new AbortController();
      const { channels, total, version, hasMore } = await fetchBatch(
        url,
        0,
        CONFIG.INITIAL_BATCH_SIZE,
        controller.signal
      );
      
      if (channels.length === 0) {
        console.log('[IPTV] No channels returned');
        return false;
      }
      
      const serverTotal = total > 0 ? total : channels.length;
      
      setTotalChannels(serverTotal);
      setLoadedChannels(channels.length);
      allChannelsRef.current = channels;
      
      const cats = groupChannelsRef.current(channels);
      setCategories(cats);
      
      if (cats.length > 0 && cats[0].channels.length > 0) {
        setCurrentChannel(cats[0].channels[0]);
      }
      
      setAssignedPlaylist({ id: playlistId, name: playlistName, cdn_url: url });
      setHasPlaylist(true);
      setIsLoading(false);
      
      console.log(`[IPTV] Initial: ${channels.length}/${serverTotal} channels`);
      
      await cache.save({
        key: playlistId,
        channels,
        version,
        cachedAt: Date.now(),
        total: serverTotal,
        complete: !hasMore && channels.length >= serverTotal,
      });
      
      if (hasMore || channels.length < serverTotal) {
        setLoadingProgress(`Carregando: ${channels.length.toLocaleString()} canais`);
        setIsLoadingMore(true);
        loadAllChannelsBackground(url, serverTotal, channels, version);
      } else {
        setLoadingProgress('');
      }
      
      return true;

    } catch (err: any) {
      console.error('[IPTV] Error loading from URL:', err);
      return false;
    }
  }, [loadAllChannelsBackground]);

  // Load from playlist-serve (PRIMARY method)
  const loadFromPlaylistServe = useCallback(async (playlistKey: string) => {
    playlistKeyRef.current = playlistKey;
    
    try {
      setLoadingProgress('Carregando playlist...');
      
      const endpoint = `${CONFIG.PLAYLIST_SERVE_URL}/playlist/${playlistKey}`;
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
      
      // FIXED: Use actual server total, NOT a forced minimum
      const serverTotal = data.total || data.channels.length;
      console.log(`[IPTV] playlist-serve: ${data.channels.length}/${serverTotal} entries`);
      
      setTotalChannels(serverTotal);
      setLoadedChannels(data.channels.length);
      allChannelsRef.current = data.channels;
      
      const cats = groupChannelsRef.current(data.channels);
      setCategories(cats);
      
      if (cats.length > 0 && cats[0].channels.length > 0) {
        setCurrentChannel(cats[0].channels[0]);
      }
      
      setAssignedPlaylist({ id: playlistKey, name: data.name || 'Lista VIP', cdn_url: null });
      setHasPlaylist(true);
      setIsLoading(false);
      
      // Continue loading only if hasMore or we haven't reached total
      if (data.hasMore && data.channels.length < serverTotal) {
        setIsLoadingMore(true);
        setLoadingProgress(`Carregando: ${data.channels.length.toLocaleString()}/${serverTotal.toLocaleString()}`);
        loadPlaylistServeBackground(playlistKey, serverTotal, data.channels, data.version || 1);
      } else {
        setLoadingProgress('');
        console.log('[IPTV] Playlist complete on first batch');
      }
      
      return true;
      
    } catch (err: any) {
      console.error('[IPTV] playlist-serve error:', err);
      return false;
    }
  }, []);

  // Background loader - FIXED: proper stop conditions
  const loadPlaylistServeBackground = useCallback(async (
    playlistKey: string,
    serverTotal: number,
    initialChannels: any[],
    version: number
  ) => {
    // Prevent duplicate calls
    if (isBackgroundLoadingRef.current) {
      console.log('[IPTV] Background already running');
      return;
    }
    
    isBackgroundLoadingRef.current = true;
    
    const controller = new AbortController();
    abortControllerRef.current = controller;
    
    let currentOffset = initialChannels.length;
    let consecutiveEmptyBatches = 0;
    let retryCycles = 0;
    
    const endpoint = `${CONFIG.PLAYLIST_SERVE_URL}/playlist/${playlistKey}`;
    
    console.log(`[IPTV] Background: offset ${currentOffset}, target ${serverTotal}`);
    
    try {
      while (!controller.signal.aborted) {
        // STOP CONDITION 1: Reached or exceeded server total
        if (currentOffset >= serverTotal) {
          console.log(`[IPTV] Complete: ${currentOffset} >= ${serverTotal}`);
          break;
        }
        
        // STOP CONDITION 2: Too many empty batches
        if (consecutiveEmptyBatches >= CONFIG.MAX_CONSECUTIVE_EMPTY) {
          console.log(`[IPTV] Stopping: ${consecutiveEmptyBatches} empty batches`);
          break;
        }
        
        // STOP CONDITION 3: Too many retry cycles
        if (retryCycles >= CONFIG.MAX_RETRY_CYCLES) {
          console.log(`[IPTV] Stopping: ${retryCycles} retry cycles`);
          break;
        }
        
        // Build batch requests
        const batchPromises: Promise<{ channels: any[]; offset: number; hasMore: boolean; success: boolean }>[] = [];
        
        const remainingItems = serverTotal - currentOffset;
        const batchesToFetch = Math.min(
          CONFIG.PARALLEL_BATCHES,
          Math.ceil(remainingItems / CONFIG.BACKGROUND_BATCH_SIZE)
        );
        
        for (let i = 0; i < batchesToFetch; i++) {
          const batchOffset = currentOffset + (i * CONFIG.BACKGROUND_BATCH_SIZE);
          if (batchOffset >= serverTotal) break;
          
          const batchLimit = Math.min(CONFIG.BACKGROUND_BATCH_SIZE, serverTotal - batchOffset);
          const params = new URLSearchParams({ 
            offset: String(batchOffset), 
            limit: String(batchLimit) 
          });
          
          batchPromises.push(
            fetch(`${endpoint}?${params}`, { signal: controller.signal })
              .then(r => r.json())
              .then(data => ({ 
                channels: data.channels || [], 
                offset: batchOffset,
                hasMore: data.hasMore !== false,
                success: true
              }))
              .catch(err => {
                console.warn(`[IPTV] Batch error at ${batchOffset}:`, err.message);
                return { channels: [], offset: batchOffset, hasMore: true, success: false };
              })
          );
        }

        if (batchPromises.length === 0) {
          console.log('[IPTV] No batches to fetch');
          break;
        }

        const results = await Promise.all(batchPromises);
        results.sort((a, b) => a.offset - b.offset);
        
        let totalNewChannels = 0;
        let anyServerSaysNoMore = false;
        
        for (const result of results) {
          if (result.channels.length > 0) {
            allChannelsRef.current = [...allChannelsRef.current, ...result.channels];
            totalNewChannels += result.channels.length;
          }
          
          // CRITICAL: Check if server says no more data
          if (!result.hasMore && result.success) {
            anyServerSaysNoMore = true;
          }
        }

        if (totalNewChannels === 0) {
          consecutiveEmptyBatches++;
          
          // Server definitively says no more - stop immediately
          if (anyServerSaysNoMore) {
            console.log(`[IPTV] Server says no more data. Loaded: ${allChannelsRef.current.length}`);
            break;
          }
          
          retryCycles++;
          await new Promise(r => setTimeout(r, CONFIG.RETRY_DELAY_MS));
          continue;
        }
        
        // Success - reset counters and advance
        consecutiveEmptyBatches = 0;
        currentOffset = allChannelsRef.current.length;
        
        // Update UI
        updateUIInBackground(
          allChannelsRef.current,
          serverTotal,
          `Sincronizando: ${allChannelsRef.current.length.toLocaleString()}/${serverTotal.toLocaleString()}`
        );

        // Small delay between batches
        await new Promise(r => setTimeout(r, CONFIG.BATCH_DELAY_MS));
      }
      
      // Final save and update
      const finalCount = allChannelsRef.current.length;
      
      await cache.save({
        key: playlistKey,
        channels: allChannelsRef.current,
        version,
        cachedAt: Date.now(),
        total: finalCount,
        complete: true,
      });
      
      startTransition(() => {
        setCategories(groupChannelsRef.current(allChannelsRef.current));
        setTotalChannels(finalCount);
        setLoadedChannels(finalCount);
        setIsLoadingMore(false);
        setLoadingProgress('');
      });
      
      console.log(`[IPTV] Background complete: ${finalCount} channels`);
      
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        console.error('[IPTV] Background error:', err);
      }
    } finally {
      isBackgroundLoadingRef.current = false;
      setIsLoadingMore(false);
      setLoadingProgress('');
    }
  }, [updateUIInBackground]);

  // Find assigned playlist for client
  const findAssignedPlaylist = useCallback(async (): Promise<boolean> => {
    try {
      const { data: session } = await supabase.auth.getSession();
      
      if (!session?.session?.user?.id) {
        console.log('[IPTV] No authenticated user');
        setHasPlaylist(false);
        setIsLoading(false);
        return false;
      }

      // Try playlist-serve first (fastest)
      const playlistServeLoaded = await loadFromPlaylistServe('lista-vip');
      if (playlistServeLoaded) {
        return true;
      }

      // Fallback to database lookup
      const { data: clientData, error: clientError } = await supabase
        .from('clientes')
        .select('id, nome')
        .eq('user_id', session.session.user.id)
        .maybeSingle();

      if (clientError) {
        console.error('[IPTV] Client lookup error:', clientError);
      }

      if (!clientData) {
        console.log('[IPTV] No client record found');
        setHasPlaylist(false);
        setIsLoading(false);
        return false;
      }

      // Check custom list assignment
      const { data: customAssignment, error: customError } = await supabase
        .from('client_m3u_custom_assignments')
        .select(`
          custom_list_id,
          m3u_custom_lists:custom_list_id (
            id,
            name,
            cdn_url,
            status
          )
        `)
        .eq('cliente_id', clientData.id)
        .maybeSingle();

      if (customError) {
        console.error('[IPTV] Custom assignment lookup error:', customError);
      }

      if (customAssignment?.m3u_custom_lists) {
        const customList = customAssignment.m3u_custom_lists as any;
        if (customList.status === 'active' && customList.cdn_url) {
          console.log('[IPTV] Found custom list:', customList.name);
          return loadPlaylistFromURL(customList.cdn_url, customList.id, customList.name);
        }
      }

      // Check regular list assignment
      const { data: regularAssignment, error: regularError } = await supabase
        .from('client_m3u_lists')
        .select(`
          m3u_list_id,
          is_active,
          m3u_lists:m3u_list_id (
            id,
            name,
            file_url,
            status
          )
        `)
        .eq('client_id', clientData.id)
        .eq('is_active', true)
        .maybeSingle();

      if (regularError) {
        console.error('[IPTV] Regular assignment lookup error:', regularError);
      }

      if (regularAssignment?.m3u_lists) {
        const regularList = regularAssignment.m3u_lists as any;
        if (regularList.status === 'active' && regularList.file_url) {
          console.log('[IPTV] Found regular list:', regularList.name);
          return loadPlaylistFromURL(regularList.file_url, regularList.id, regularList.name);
        }
      }

      // Check default list
      const { data: defaultList, error: defaultError } = await supabase
        .from('m3u_lists')
        .select('id, name, file_url')
        .eq('is_default', true)
        .eq('status', 'active')
        .maybeSingle();

      if (defaultError) {
        console.error('[IPTV] Default list lookup error:', defaultError);
      }

      if (defaultList?.file_url) {
        console.log('[IPTV] Using default list:', defaultList.name);
        return loadPlaylistFromURL(defaultList.file_url, defaultList.id, defaultList.name);
      }

      console.log('[IPTV] No playlist found');
      setHasPlaylist(false);
      setIsLoading(false);
      return false;

    } catch (err: any) {
      console.error('[IPTV] Error finding playlist:', err);
      setHasPlaylist(false);
      setIsLoading(false);
      return false;
    }
  }, [loadPlaylistFromURL, loadFromPlaylistServe]);

  // Initialize on mount - FIXED: empty dependency array to run only once
  useEffect(() => {
    findAssignedPlaylist();
    
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Channel navigation
  const changeChannel = useCallback((channel: Channel) => {
    setCurrentChannel(channel);
  }, []);

  const navigateChannels = useCallback((direction: 'next' | 'prev') => {
    if (!currentChannel) return;
    
    const allChannels = categories.flatMap(cat => cat.channels);
    const currentIndex = allChannels.findIndex(ch => ch.id === currentChannel.id);
    
    if (currentIndex === -1) return;
    
    const newIndex = direction === 'next'
      ? (currentIndex + 1) % allChannels.length
      : (currentIndex - 1 + allChannels.length) % allChannels.length;
    
    setCurrentChannel(allChannels[newIndex]);
  }, [currentChannel, categories]);

  const nextChannel = useCallback(() => navigateChannels('next'), [navigateChannels]);
  const previousChannel = useCallback(() => navigateChannels('prev'), [navigateChannels]);

  // Clear cache and reload
  const clearCacheAndReload = useCallback(async () => {
    setIsLoading(true);
    setLoadingProgress('Limpando cache...');
    
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    
    isBackgroundLoadingRef.current = false;
    
    await cache.clearAll();
    allChannelsRef.current = [];
    setCategories([]);
    setTotalChannels(0);
    setLoadedChannels(0);
    setIsCached(false);
    
    await findAssignedPlaylist();
  }, [findAssignedPlaylist]);

  // Search function
  const searchChannels = useCallback((query: string): Channel[] => {
    if (!query || query.length < 2) return [];
    
    const lowerQuery = query.toLowerCase();
    return allChannelsRef.current
      .filter(ch => 
        (ch.name || ch.title || '').toLowerCase().includes(lowerQuery) ||
        (ch.category_name || ch.group_title || '').toLowerCase().includes(lowerQuery)
      )
      .slice(0, 50)
      .map(ch => ({
        id: ch.id || ch.entry_hash,
        name: ch.name || ch.title,
        stream_url: ch.stream_url,
        tvg_logo: ch.tvg_logo,
        tvg_id: ch.tvg_id,
        category_id: 'search',
        category_name: ch.category_name || ch.group_title,
        order_position: 0
      }));
  }, []);

  // Lazy load channels for a specific category
  const loadCategoryChannels = useCallback(async (categoryId: string) => {
    setSelectedCategoryId(categoryId);
    // Channels are already loaded, just filter display
  }, []);

  return {
    categories,
    currentChannel,
    isLoading,
    assignedPlaylist,
    loadingProgress,
    loadingPercent,
    totalChannels,
    loadedChannels,
    isLoadingMore,
    hasPlaylist,
    isCached,
    selectedCategoryId,
    isCategoryLoading,
    changeChannel,
    nextChannel,
    previousChannel,
    clearCacheAndReload,
    searchChannels,
    loadCategoryChannels,
    // Smart prefetch: get stream URL on demand
    getStreamUrl: getStoredStreamUrl,
  };
}
