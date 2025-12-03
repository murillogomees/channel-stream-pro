/**
 * useChannelPreloadEffect - Preload adjacent channels for instant switching
 * 
 * Preloads manifests of channels before/after current channel
 * for Netflix-style instant channel switching.
 */

import { useEffect, useCallback, useRef } from 'react';
import { usePlayerPerformance } from './usePlayerPerformance';

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
  const performance = usePlayerPerformance({ enablePreload: enabled });
  const lastPreloadedRef = useRef<string>('');

  /**
   * Preload adjacent channels when current channel changes
   */
  useEffect(() => {
    if (!enabled || !currentChannelId || channels.length === 0) return;
    if (lastPreloadedRef.current === currentChannelId) return;
    
    lastPreloadedRef.current = currentChannelId;
    
    const currentIndex = channels.findIndex(c => c.id === currentChannelId);
    if (currentIndex === -1) return;

    const preloadBatch: Array<{ url: string; priority: 'high' | 'medium' | 'low' }> = [];

    // High priority: immediate neighbors
    if (currentIndex > 0) {
      preloadBatch.push({
        url: channels[currentIndex - 1].stream_url,
        priority: 'high',
      });
    }
    if (currentIndex < channels.length - 1) {
      preloadBatch.push({
        url: channels[currentIndex + 1].stream_url,
        priority: 'high',
      });
    }

    // Medium priority: 2 steps away
    if (currentIndex > 1) {
      preloadBatch.push({
        url: channels[currentIndex - 2].stream_url,
        priority: 'medium',
      });
    }
    if (currentIndex < channels.length - 2) {
      preloadBatch.push({
        url: channels[currentIndex + 2].stream_url,
        priority: 'medium',
      });
    }

    // Low priority: 3 steps away
    if (currentIndex < channels.length - 3) {
      preloadBatch.push({
        url: channels[currentIndex + 3].stream_url,
        priority: 'low',
      });
    }

    // Execute preload
    if (preloadBatch.length > 0) {
      console.log(`[ChannelPreload] Preloading ${preloadBatch.length} adjacent channels`);
      performance.preloadBatch(preloadBatch);
    }
  }, [currentChannelId, channels, enabled, performance]);

  /**
   * Check if a channel is preloaded
   */
  const isChannelPreloaded = useCallback((channelId: string): boolean => {
    const channel = channels.find(c => c.id === channelId);
    if (!channel) return false;
    return performance.isUrlPreloaded(channel.stream_url);
  }, [channels, performance]);

  /**
   * Manually preload a specific channel
   */
  const preloadChannel = useCallback(async (channelId: string): Promise<boolean> => {
    const channel = channels.find(c => c.id === channelId);
    if (!channel) return false;
    const result = await performance.preloadStream(channel.stream_url, 'high');
    return !!result;
  }, [channels, performance]);

  return {
    isChannelPreloaded,
    preloadChannel,
    metrics: performance.metrics,
    isWorkerReady: performance.isWorkerReady,
  };
}

export default useChannelPreloadEffect;
