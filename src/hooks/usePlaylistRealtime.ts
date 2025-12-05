/**
 * Playlist Realtime Sync Hook
 * 
 * Subscribes to Supabase realtime for:
 * - Channel updates (name, URL changes)
 * - Category changes
 * - New channels added
 * - Channels removed
 * 
 * Updates local state without full refresh
 */

import { useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { playlistCacheService } from '@/services/playlistCacheService';
import type { RealtimeChannel } from '@supabase/supabase-js';

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

interface UsePlaylistRealtimeOptions {
  playlistId: string | null;
  onChannelUpdate?: (channel: Channel) => void;
  onChannelInsert?: (channel: Channel) => void;
  onChannelDelete?: (channelId: string) => void;
  onCategoryUpdate?: (category: Partial<Category>) => void;
  onFullRefresh?: () => void;
}

export function usePlaylistRealtime({
  playlistId,
  onChannelUpdate,
  onChannelInsert,
  onChannelDelete,
  onCategoryUpdate,
  onFullRefresh,
}: UsePlaylistRealtimeOptions) {
  const channelRef = useRef<RealtimeChannel | null>(null);
  const categoryIdsRef = useRef<Set<string>>(new Set());

  // Track category IDs we're interested in
  const setCategoryIds = useCallback((ids: string[]) => {
    categoryIdsRef.current = new Set(ids);
  }, []);

  useEffect(() => {
    if (!playlistId) return;

    console.log('[PlaylistRealtime] Subscribing to playlist:', playlistId);

    // Subscribe to channels table changes
    const channel = supabase
      .channel(`playlist-sync-${playlistId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'm3u_channels',
        },
        (payload) => {
          const updated = payload.new as any;
          // Only process if it's a category we care about
          if (categoryIdsRef.current.has(updated.category_id)) {
            console.log('[PlaylistRealtime] Channel updated:', updated.name);
            onChannelUpdate?.({
              id: updated.id,
              name: updated.name,
              stream_url: updated.stream_url,
              tvg_logo: updated.tvg_logo,
              tvg_id: updated.tvg_id,
              category_id: updated.category_id,
              order_position: updated.order_position,
            });
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'm3u_channels',
        },
        (payload) => {
          const inserted = payload.new as any;
          if (categoryIdsRef.current.has(inserted.category_id)) {
            console.log('[PlaylistRealtime] Channel inserted:', inserted.name);
            onChannelInsert?.({
              id: inserted.id,
              name: inserted.name,
              stream_url: inserted.stream_url,
              tvg_logo: inserted.tvg_logo,
              tvg_id: inserted.tvg_id,
              category_id: inserted.category_id,
              order_position: inserted.order_position,
            });
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'm3u_channels',
        },
        (payload) => {
          const deleted = payload.old as any;
          if (categoryIdsRef.current.has(deleted.category_id)) {
            console.log('[PlaylistRealtime] Channel deleted:', deleted.id);
            onChannelDelete?.(deleted.id);
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'm3u_categories',
          filter: `custom_list_id=eq.${playlistId}`,
        },
        (payload) => {
          const updated = payload.new as any;
          console.log('[PlaylistRealtime] Category updated:', updated.name);
          onCategoryUpdate?.({
            id: updated.id,
            name: updated.name,
            display_name: updated.display_name,
            icon: updated.icon,
          });
        }
      )
      .subscribe((status) => {
        console.log('[PlaylistRealtime] Subscription status:', status);
        if (status === 'CHANNEL_ERROR') {
          console.error('[PlaylistRealtime] Subscription error');
        }
      });

    channelRef.current = channel;

    return () => {
      console.log('[PlaylistRealtime] Unsubscribing');
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [playlistId, onChannelUpdate, onChannelInsert, onChannelDelete, onCategoryUpdate]);

  // Force a full refresh (e.g., on reconnect after long offline)
  const forceRefresh = useCallback(() => {
    if (playlistId) {
      playlistCacheService.clearAll().then(() => {
        onFullRefresh?.();
      });
    }
  }, [playlistId, onFullRefresh]);

  return {
    setCategoryIds,
    forceRefresh,
  };
}
