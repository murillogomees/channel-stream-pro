/**
 * useChannelPreloadEffect - Preload adjacent channels for instant switching
 * 
 * Preloads manifests of channels before/after current channel
 * for Netflix-style instant channel switching.
 */

import { useEffect, useCallback, useRef } from 'react';
import { useChannelPreloader } from './useChannelPreloader';

interface Channel {
  id: string;
  name: string;
  stream_url: string;
}

interface UseChannelPreloadEffectOptions {
  channels: Channel[];
  currentChannelId?: string;
  enabled?: boolean;
}

export function useChannelPreloadEffect({
  channels,
  currentChannelId,
  enabled = true,
}: UseChannelPreloadEffectOptions) {
  const lastPreloadedRef = useRef<string>('');
  
  // Use the unified preloader
  const preloader = useChannelPreloader({
    channels: channels as Array<{ id: string; name: string; stream_url: string }>,
    currentChannelId,
    enabled,
  });

  /**
   * Preload adjacent channels when current channel changes
   */
  useEffect(() => {
    if (!enabled || !currentChannelId || channels.length === 0) return;
    if (lastPreloadedRef.current === currentChannelId) return;
    
    lastPreloadedRef.current = currentChannelId;
    
    const currentIndex = channels.findIndex(c => c.id === currentChannelId);
    if (currentIndex === -1) return;

    // Preload adjacent channels using preloader
    const adjacentUrls: string[] = [];

    // High priority: immediate neighbors
    if (currentIndex > 0 && channels[currentIndex - 1].stream_url) {
      adjacentUrls.push(channels[currentIndex - 1].stream_url);
    }
    if (currentIndex < channels.length - 1 && channels[currentIndex + 1].stream_url) {
      adjacentUrls.push(channels[currentIndex + 1].stream_url);
    }

    // Medium priority: 2 steps away
    if (currentIndex > 1 && channels[currentIndex - 2].stream_url) {
      adjacentUrls.push(channels[currentIndex - 2].stream_url);
    }
    if (currentIndex < channels.length - 2 && channels[currentIndex + 2].stream_url) {
      adjacentUrls.push(channels[currentIndex + 2].stream_url);
    }

    // Execute preload
    if (adjacentUrls.length > 0) {
      console.log(`[ChannelPreload] Preloading ${adjacentUrls.length} adjacent channels`);
      adjacentUrls.forEach(url => preloader.preloadUrl(url));
    }
  }, [currentChannelId, channels, enabled, preloader]);

  /**
   * Check if a channel is preloaded
   */
  const isChannelPreloaded = useCallback((channelId: string): boolean => {
    const status = preloader.getChannelPreloadStatus(channelId);
    return status.isPreloaded;
  }, [preloader]);

  /**
   * Manually preload a specific channel
   */
  const preloadChannel = useCallback(async (channelId: string): Promise<boolean> => {
    const channel = channels.find(c => c.id === channelId);
    if (!channel?.stream_url) return false;
    preloader.preloadUrl(channel.stream_url);
    return true;
  }, [channels, preloader]);

  return {
    isChannelPreloaded,
    preloadChannel,
    stats: preloader.stats,
    isPreloading: preloader.isPreloading,
  };
}

export default useChannelPreloadEffect;
