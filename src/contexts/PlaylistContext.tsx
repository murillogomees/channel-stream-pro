/**
 * PlaylistContext - Single source of truth for all playlist content
 * 
 * Loads content ONCE and shares across all tabs (Home, Live, Movies, Series)
 * Content is append-only to avoid UI shifts
 */

import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface LightChannel {
  id: string;
  name: string;
  logo: string | null;
  cat: string;
  seq: number;
}

interface ResolvedChannel {
  id: string;
  name: string;
  stream_url: string;
  original_url: string;
  logo: string | null;
  category: string | null;
  needsProxy: boolean;
}

interface Category {
  id: string;
  name: string;
  display_name: string;
  icon: string | null;
  channels: LightChannel[];
}

interface PlaylistContextType {
  categories: Category[];
  allChannels: LightChannel[];
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

const PlaylistContext = createContext<PlaylistContextType | null>(null);

// Resolve stream URL on-demand via edge function
async function resolveStreamUrl(channelId: string): Promise<ResolvedChannel | null> {
  try {
    const { data, error } = await supabase.functions.invoke('stream-url-resolve', {
      body: { channelId }
    });
    
    if (error || !data) return null;
    return data as ResolvedChannel;
  } catch {
    return null;
  }
}

export function PlaylistProvider({ children }: { children: React.ReactNode }) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [allChannels, setAllChannels] = useState<LightChannel[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadingProgress, setLoadingProgress] = useState('');
  const [totalChannels, setTotalChannels] = useState(0);
  const [loadedChannels, setLoadedChannels] = useState(0);
  const [hasPlaylist, setHasPlaylist] = useState(false);
  const [isResolvingStream, setIsResolvingStream] = useState(false);
  
  const allChannelsRef = useRef<LightChannel[]>([]);
  const categoryMapRef = useRef<Map<string, Category>>(new Map());
  const initCalledRef = useRef(false);
  const loadingRef = useRef(false);

  // Group channels into categories (append-only to prevent UI shifts)
  const updateCategoriesAppendOnly = useCallback((newChannels: LightChannel[]) => {
    for (const channel of newChannels) {
      const catName = channel.cat || 'Geral';
      
      if (!categoryMapRef.current.has(catName)) {
        categoryMapRef.current.set(catName, {
          id: `cat-${categoryMapRef.current.size}`,
          name: catName,
          display_name: catName,
          icon: null,
          channels: [],
        });
      }
      
      const cat = categoryMapRef.current.get(catName)!;
      if (!cat.channels.some(ch => ch.id === channel.id)) {
        cat.channels.push(channel);
      }
    }
    
    const sortedCategories = Array.from(categoryMapRef.current.values())
      .sort((a, b) => a.display_name.localeCompare(b.display_name));
    
    setCategories(sortedCategories);
  }, []);

  // Load category names efficiently
  const loadAllCategoryNames = useCallback(async (): Promise<{ categories: string[], totalScanned: number }> => {
    try {
      const allCategories = new Set<string>();
      
      const { count } = await supabase
        .from('m3u_sync_entries')
        .select('*', { count: 'exact', head: true });
      
      const { data: sampleData } = await supabase
        .from('m3u_sync_entries')
        .select('group_title')
        .order('group_title', { ascending: true })
        .limit(5000);
      
      if (sampleData) {
        sampleData.forEach(row => {
          if (row.group_title) allCategories.add(row.group_title);
        });
      }
      
      const { data: lastData } = await supabase
        .from('m3u_sync_entries')
        .select('group_title')
        .order('group_title', { ascending: false })
        .limit(5000);
      
      if (lastData) {
        lastData.forEach(row => {
          if (row.group_title) allCategories.add(row.group_title);
        });
      }
      
      const uniqueCategories = Array.from(allCategories).sort();
      console.log(`[Playlist] Found ${uniqueCategories.length} categories, ~${count || 0} entries`);
      return { categories: uniqueCategories, totalScanned: count || 0 };
      
    } catch (error) {
      console.error('[Playlist] loadAllCategoryNames error:', error);
      return { categories: [], totalScanned: 0 };
    }
  }, []);

  // Load content by category
  const loadContentByCategories = useCallback(async (categoryNames: string[]) => {
    const PARALLEL_CATEGORIES = 10;
    
    for (let i = 0; i < categoryNames.length; i += PARALLEL_CATEGORIES) {
      const batch = categoryNames.slice(i, i + PARALLEL_CATEGORIES);
      
      setLoadingProgress(`Carregando ${Math.min(i + PARALLEL_CATEGORIES, categoryNames.length)}/${categoryNames.length} categorias...`);
      
      const promises = batch.map(async (catName) => {
        const { data } = await supabase
          .from('m3u_sync_entries')
          .select('id, title, tvg_logo, group_title')
          .eq('group_title', catName)
          .order('title', { ascending: true });
        
        if (!data) return [];
        
        return data.map((ch, idx): LightChannel => ({
          id: ch.id,
          name: ch.title || 'Canal',
          logo: ch.tvg_logo,
          cat: ch.group_title || 'Geral',
          seq: allChannelsRef.current.length + idx,
        }));
      });
      
      const results = await Promise.all(promises);
      const newChannels = results.flat();
      
      allChannelsRef.current = [...allChannelsRef.current, ...newChannels];
      setAllChannels([...allChannelsRef.current]);
      setLoadedChannels(allChannelsRef.current.length);
      
      updateCategoriesAppendOnly(newChannels);
      
      if (i + PARALLEL_CATEGORIES < categoryNames.length) {
        await new Promise(r => setTimeout(r, 20));
      }
    }
  }, [updateCategoriesAppendOnly]);

  // Main initialization
  const initialize = useCallback(async () => {
    if (initCalledRef.current || loadingRef.current) return;
    initCalledRef.current = true;
    loadingRef.current = true;
    
    setIsLoading(true);
    setLoadingProgress('Verificando playlist...');
    
    try {
      const { categories: categoryNames, totalScanned } = await loadAllCategoryNames();
      setTotalChannels(totalScanned);
      
      if (categoryNames.length === 0) {
        setHasPlaylist(false);
        setIsLoading(false);
        loadingRef.current = false;
        return;
      }
      
      setHasPlaylist(true);
      
      for (const name of categoryNames) {
        if (!categoryMapRef.current.has(name)) {
          categoryMapRef.current.set(name, {
            id: `cat-${categoryMapRef.current.size}`,
            name,
            display_name: name,
            icon: null,
            channels: [],
          });
        }
      }
      setCategories(Array.from(categoryMapRef.current.values()).sort((a, b) => 
        a.display_name.localeCompare(b.display_name)
      ));
      
      setIsLoading(false);
      
      await loadContentByCategories(categoryNames);
      
      setLoadingProgress('');
      console.log(`[Playlist] Complete: ${allChannelsRef.current.length} channels`);
      
    } catch (error) {
      console.error('[Playlist] Init error:', error);
      setHasPlaylist(false);
    } finally {
      setIsLoading(false);
      setLoadingProgress('');
      loadingRef.current = false;
    }
  }, [loadAllCategoryNames, loadContentByCategories]);

  // Resolve stream URL on-demand
  const resolveChannel = useCallback(async (channelId: string): Promise<ResolvedChannel | null> => {
    setIsResolvingStream(true);
    try {
      return await resolveStreamUrl(channelId);
    } finally {
      setIsResolvingStream(false);
    }
  }, []);

  // Refresh
  const refresh = useCallback(async () => {
    initCalledRef.current = false;
    loadingRef.current = false;
    categoryMapRef.current.clear();
    allChannelsRef.current = [];
    setCategories([]);
    setAllChannels([]);
    setLoadedChannels(0);
    await initialize();
  }, [initialize]);

  // Auto-init
  useEffect(() => {
    initialize();
  }, [initialize]);

  return (
    <PlaylistContext.Provider value={{
      categories,
      allChannels,
      isLoading,
      loadingProgress,
      totalChannels,
      loadedChannels,
      hasPlaylist,
      resolveChannel,
      isResolvingStream,
      refresh,
    }}>
      {children}
    </PlaylistContext.Provider>
  );
}

export function usePlaylist() {
  const context = useContext(PlaylistContext);
  if (!context) {
    throw new Error('usePlaylist must be used within a PlaylistProvider');
  }
  return context;
}
