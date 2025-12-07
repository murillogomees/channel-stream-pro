/**
 * useHomeChannels - Adapter hook that uses PlaylistContext
 * 
 * This hook now connects to the unified PlaylistContext
 * so all tabs share the same content source.
 */

import { useMemo } from 'react';
import { usePlaylist } from '@/contexts/PlaylistContext';

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

export function useHomeChannels() {
  const {
    categories: rawCategories,
    allChannels: rawChannels,
    isLoading,
    totalChannels,
    loadedChannels,
    refresh,
  } = usePlaylist();

  // Adapt LightChannel to Channel format
  const channels = useMemo(() => {
    return rawChannels.map((ch, idx) => ({
      id: ch.id,
      name: ch.name,
      stream_url: '', // Resolved on-demand
      tvg_logo: ch.logo,
      tvg_id: null,
      category_id: ch.cat,
      category_name: ch.cat,
      group_title: ch.cat,
      order_position: ch.seq || idx,
    }));
  }, [rawChannels]);

  // Adapt categories
  const categories = useMemo(() => {
    return rawCategories.map(cat => ({
      id: cat.id,
      name: cat.name,
      display_name: cat.display_name,
      channels: cat.channels.map((ch, idx) => ({
        id: ch.id,
        name: ch.name,
        stream_url: '',
        tvg_logo: ch.logo,
        tvg_id: null,
        category_id: cat.id,
        category_name: cat.name,
        group_title: cat.name,
        order_position: ch.seq || idx,
      })),
    }));
  }, [rawCategories]);

  return {
    channels,
    categories,
    isLoading,
    error: null,
    totalCount: totalChannels,
    loadedCount: loadedChannels,
    refresh,
  };
}

export default useHomeChannels;
