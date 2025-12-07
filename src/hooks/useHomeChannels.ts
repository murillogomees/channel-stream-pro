/**
 * useHomeChannels - Full playlist loading hook for home page
 * 
 * Loads ALL channels from database progressively.
 * First batch renders immediately, rest loads in background without page reload.
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

interface Category {
  id: string;
  name: string;
  display_name: string;
  channels: Channel[];
}

const INITIAL_BATCH_SIZE = 2000;
const BATCH_SIZE = 10000;

export function useHomeChannels() {
  const [channels, setChannels] = useState<Channel[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [totalCount, setTotalCount] = useState(0);
  const [loadedCount, setLoadedCount] = useState(0);
  
  const loadedRef = useRef(false);
  const allChannelsRef = useRef<Channel[]>([]);

  // Group channels by category
  const groupChannels = useCallback((channelList: Channel[]): Category[] => {
    const categoryMap = new Map<string, Category>();
    
    for (const channel of channelList) {
      const catName = channel.group_title || channel.category_name || 'Geral';
      
      if (!categoryMap.has(catName)) {
        categoryMap.set(catName, {
          id: `cat-${categoryMap.size}`,
          name: catName,
          display_name: catName,
          channels: [],
        });
      }
      
      categoryMap.get(catName)!.channels.push(channel);
    }
    
    // Sort categories alphabetically
    return Array.from(categoryMap.values()).sort((a, b) => 
      a.display_name.localeCompare(b.display_name)
    );
  }, []);

  // Map database entry to Channel format
  const mapEntry = (entry: any, idx: number): Channel => ({
    id: entry.id,
    name: entry.title || 'Sem nome',
    stream_url: entry.stream_url || '',
    tvg_logo: entry.tvg_logo || null,
    tvg_id: entry.tvg_id || null,
    category_id: entry.group_title || 'default',
    category_name: entry.group_title || 'Geral',
    group_title: entry.group_title || 'Geral',
    order_position: idx,
  });

  // Load all channels progressively from database
  const loadFromDatabase = useCallback(async () => {
    try {
      // Get total count first
      const { count } = await supabase
        .from('m3u_sync_entries')
        .select('id', { count: 'exact', head: true });
      
      const total = count || 0;
      setTotalCount(total);
      console.log(`[HomeChannels] Total entries in database: ${total}`);

      if (total === 0) {
        setError('Nenhum conteúdo disponível');
        return;
      }

      // Load first batch immediately for fast render
      const { data: firstBatch, error: firstError } = await supabase
        .from('m3u_sync_entries')
        .select('id, title, stream_url, tvg_logo, tvg_id, group_title')
        .order('group_title', { ascending: true })
        .order('title', { ascending: true })
        .range(0, INITIAL_BATCH_SIZE - 1);

      if (firstError) {
        console.error('[HomeChannels] First batch error:', firstError);
        throw firstError;
      }

      if (firstBatch && firstBatch.length > 0) {
        const firstChannels = firstBatch.map((entry, idx) => mapEntry(entry, idx));
        
        allChannelsRef.current = [...firstChannels];
        setChannels([...firstChannels]);
        setCategories(groupChannels(firstChannels));
        setLoadedCount(firstChannels.length);
        
        console.log(`[HomeChannels] First batch loaded: ${firstChannels.length} channels`);
      }

      loadedRef.current = true;
      setIsLoading(false);

      // Load remaining batches in background
      if (total > INITIAL_BATCH_SIZE) {
        loadRemainingBatches(total);
      }

    } catch (err) {
      console.error('[HomeChannels] Database error:', err);
      setError('Erro ao carregar conteúdo');
    }
  }, [groupChannels]);

  // Load remaining batches in background (append-only, no reload)
  const loadRemainingBatches = async (total: number) => {
    let offset = INITIAL_BATCH_SIZE;
    
    while (offset < total) {
      try {
        const { data: batch, error: batchError } = await supabase
          .from('m3u_sync_entries')
          .select('id, title, stream_url, tvg_logo, tvg_id, group_title')
          .order('group_title', { ascending: true })
          .order('title', { ascending: true })
          .range(offset, offset + BATCH_SIZE - 1);

        if (batchError) {
          console.warn(`[HomeChannels] Batch at ${offset} error:`, batchError);
          break;
        }

        if (!batch || batch.length === 0) {
          break;
        }

        // Append new channels (no reorder, just append)
        const newChannels = batch.map((entry, idx) => mapEntry(entry, offset + idx));
        allChannelsRef.current = [...allChannelsRef.current, ...newChannels];
        
        // Update state with appended channels
        setChannels([...allChannelsRef.current]);
        setCategories(groupChannels([...allChannelsRef.current]));
        setLoadedCount(allChannelsRef.current.length);
        
        console.log(`[HomeChannels] Loaded ${allChannelsRef.current.length} of ${total}`);
        
        offset += BATCH_SIZE;
        
        // Small delay to prevent overwhelming
        await new Promise(resolve => setTimeout(resolve, 100));
        
      } catch (err) {
        console.error('[HomeChannels] Batch error:', err);
        break;
      }
    }
    
    console.log(`[HomeChannels] Complete: ${allChannelsRef.current.length} channels loaded`);
  };

  const loadChannels = useCallback(async () => {
    if (loadedRef.current) return;
    
    try {
      setIsLoading(true);
      setError(null);
      await loadFromDatabase();
    } catch (err) {
      console.error('[HomeChannels] Error:', err);
      setError('Erro ao carregar conteúdo');
      setIsLoading(false);
    }
  }, [loadFromDatabase]);

  useEffect(() => {
    loadChannels();
  }, [loadChannels]);

  return {
    channels,
    categories,
    isLoading,
    error,
    totalCount,
    loadedCount,
    refresh: () => {
      loadedRef.current = false;
      allChannelsRef.current = [];
      setChannels([]);
      setCategories([]);
      loadChannels();
    },
  };
}

export default useHomeChannels;
