/**
 * Hook for on-demand stream resolution
 * Gets stream URL only when user wants to play
 */

import { useState, useCallback, useRef } from 'react';
import { 
  getStoredStreamUrl, 
  resolveStream, 
  prewarmStreams,
  updatePrefetchStats 
} from '@/services/smartPrefetch';

interface UseStreamOnDemandOptions {
  playlistUrl: string;
  onStreamReady?: (url: string) => void;
  onError?: (error: string) => void;
}

export function useStreamOnDemand(options: UseStreamOnDemandOptions) {
  const { playlistUrl, onStreamReady, onError } = options;
  
  const [isResolving, setIsResolving] = useState(false);
  const [currentStreamUrl, setCurrentStreamUrl] = useState<string | null>(null);
  const lastChannelIdRef = useRef<string | null>(null);
  
  /**
   * Get stream URL for a channel - uses cache first, then fetches
   */
  const getStreamUrl = useCallback(async (channelId: string): Promise<string | null> => {
    // Same channel - return cached
    if (channelId === lastChannelIdRef.current && currentStreamUrl) {
      return currentStreamUrl;
    }
    
    lastChannelIdRef.current = channelId;
    
    // Try local index first (instant)
    const storedUrl = getStoredStreamUrl(channelId);
    if (storedUrl) {
      console.log(`[StreamOnDemand] Index hit for ${channelId}`);
      updatePrefetchStats({ cacheHits: 1 });
      setCurrentStreamUrl(storedUrl);
      onStreamReady?.(storedUrl);
      return storedUrl;
    }
    
    // Need to resolve from server
    setIsResolving(true);
    updatePrefetchStats({ cacheMisses: 1 });
    
    try {
      const resolution = await resolveStream(channelId, playlistUrl);
      
      if (!resolution) {
        const errorMsg = `Não foi possível carregar o stream`;
        onError?.(errorMsg);
        return null;
      }
      
      setCurrentStreamUrl(resolution.url);
      onStreamReady?.(resolution.url);
      return resolution.url;
      
    } catch (err) {
      console.error('[StreamOnDemand] Resolution error:', err);
      onError?.('Erro ao carregar stream');
      return null;
      
    } finally {
      setIsResolving(false);
    }
  }, [playlistUrl, currentStreamUrl, onStreamReady, onError]);
  
  /**
   * Prewarm next likely channels
   */
  const prewarmNextChannels = useCallback((channelIds: string[]) => {
    if (playlistUrl) {
      prewarmStreams(channelIds, playlistUrl);
    }
  }, [playlistUrl]);
  
  /**
   * Clear current stream
   */
  const clearStream = useCallback(() => {
    setCurrentStreamUrl(null);
    lastChannelIdRef.current = null;
  }, []);
  
  return {
    getStreamUrl,
    prewarmNextChannels,
    clearStream,
    isResolving,
    currentStreamUrl,
  };
}
