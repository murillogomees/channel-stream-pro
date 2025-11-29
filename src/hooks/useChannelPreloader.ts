/**
 * ============================================================================
 * useChannelPreloader - Channel-specific Preloading Hook
 * ============================================================================
 * 
 * High-level hook for integrating intelligent preloading with channel lists.
 * Use this in components that display/navigate channels.
 */

import { useEffect, useCallback, useMemo } from 'react';
import { useIntelligentPreload } from './useIntelligentPreload';

interface Channel {
  id: string;
  name: string;
  stream_url: string;
  tvg_logo?: string;
  category_id?: string;
}

interface UseChannelPreloaderOptions {
  channels: Channel[];
  currentChannelId?: string;
  currentCategoryId?: string;
  profileId?: string;
  enabled?: boolean;
}

export function useChannelPreloader({
  channels,
  currentChannelId,
  currentCategoryId,
  profileId,
  enabled = true,
}: UseChannelPreloaderOptions) {
  const {
    candidates,
    isPreloading,
    stats,
    cacheSize,
    updateContext,
    getCachedManifest,
    isPreloaded,
    preloadUrl,
    clearCache,
  } = useIntelligentPreload();

  // Convert channels to simplified format
  const channelList = useMemo(() => 
    channels.map(c => ({
      id: c.id,
      stream_url: c.stream_url,
      name: c.name,
    })),
    [channels]
  );

  // Update preload context when channel changes
  useEffect(() => {
    if (!enabled || channels.length === 0) return;

    updateContext({
      currentChannelId,
      currentCategoryId,
      channelList,
      profileId,
    });
  }, [enabled, currentChannelId, currentCategoryId, channelList, profileId, updateContext]);

  /**
   * Get playable URL with preload check
   * Returns cached manifest URL hint if available
   */
  const getPlayableUrl = useCallback((channel: Channel): {
    url: string;
    isPreloaded: boolean;
    cachedManifest: string | null;
  } => {
    const cached = getCachedManifest(channel.stream_url);
    return {
      url: channel.stream_url,
      isPreloaded: !!cached,
      cachedManifest: cached,
    };
  }, [getCachedManifest]);

  /**
   * Preload adjacent channels when hovering/focusing
   */
  const preloadOnHover = useCallback((channelId: string) => {
    const index = channels.findIndex(c => c.id === channelId);
    if (index === -1) return;

    const toPreload: string[] = [];
    
    // Preload prev/next
    if (index > 0) toPreload.push(channels[index - 1].stream_url);
    if (index < channels.length - 1) toPreload.push(channels[index + 1].stream_url);

    toPreload.forEach(url => {
      if (!isPreloaded(url)) {
        preloadUrl(url);
      }
    });
  }, [channels, isPreloaded, preloadUrl]);

  /**
   * Get preload status for a channel
   */
  const getChannelPreloadStatus = useCallback((channelId: string): {
    isPreloaded: boolean;
    isPending: boolean;
    priority?: 'high' | 'medium' | 'low';
    reason?: string;
  } => {
    const channel = channels.find(c => c.id === channelId);
    if (!channel) return { isPreloaded: false, isPending: false };

    const candidate = candidates.find(c => c.id === channelId);
    const preloaded = isPreloaded(channel.stream_url);

    return {
      isPreloaded: preloaded,
      isPending: candidate && !preloaded ? true : false,
      priority: candidate?.priority,
      reason: candidate?.reason,
    };
  }, [channels, candidates, isPreloaded]);

  return {
    // State
    preloadCandidates: candidates,
    isPreloading,
    stats,
    cacheSize,
    
    // Actions
    getPlayableUrl,
    preloadOnHover,
    getChannelPreloadStatus,
    clearCache,
    
    // Direct access
    preloadUrl,
    isPreloaded: (url: string) => isPreloaded(url),
  };
}

export default useChannelPreloader;
