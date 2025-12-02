/**
 * useCdnPlayer - Hook for CDN-aware video playback
 * 
 * Handles intelligent routing through CDN Worker with automatic fallback
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { cdnRoutingService, PlaybackResult } from '@/services/cdnRoutingService';
import { streamService, Channel } from '@/modules/player/services/StreamService';

interface UseCdnPlayerOptions {
  channel: Channel | null;
  enabled?: boolean;
}

interface UseCdnPlayerReturn {
  playbackUrl: string | null;
  source: PlaybackResult['source'] | null;
  isLoading: boolean;
  error: string | null;
  fallbackUrl: string | null;
  requiresToken: boolean;
  retry: () => void;
}

export function useCdnPlayer({ 
  channel, 
  enabled = true 
}: UseCdnPlayerOptions): UseCdnPlayerReturn {
  const [playbackResult, setPlaybackResult] = useState<PlaybackResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const tokenRefreshTimer = useRef<NodeJS.Timeout | null>(null);
  const retryAttempts = useRef(0);
  const maxRetries = 2;

  /**
   * Fetch optimized playback URL
   */
  const fetchPlaybackUrl = useCallback(async () => {
    if (!channel || !enabled) {
      setPlaybackResult(null);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const result = await cdnRoutingService.getPlaybackUrl(channel);
      
      setPlaybackResult(result);
      retryAttempts.current = 0;

      console.log('[CDN Player] Playback URL resolved:', {
        source: result.source,
        channel: channel.name,
        requiresToken: result.requiresToken,
      });

      // Setup token refresh if needed (refresh at 1h50min for 2h tokens)
      if (result.requiresToken && result.expiresAt) {
        const refreshTime = result.expiresAt - Date.now() - (10 * 60 * 1000); // 10 min before expiry
        
        if (refreshTime > 0) {
          tokenRefreshTimer.current = setTimeout(async () => {
            console.log('[CDN Player] Refreshing token...');
            await fetchPlaybackUrl();
          }, refreshTime);
        }
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to get playback URL';
      console.error('[CDN Player] Error:', errorMsg);
      setError(errorMsg);

      // Fallback to standard stream service on error
      if (retryAttempts.current < maxRetries) {
        retryAttempts.current++;
        console.log(`[CDN Player] Retrying... (${retryAttempts.current}/${maxRetries})`);
        setTimeout(fetchPlaybackUrl, 1000 * retryAttempts.current);
      } else {
        // Use basic fallback
        const fallbackUrl = streamService.getPlayableUrl(channel);
        setPlaybackResult({
          url: fallbackUrl,
          source: 'stream_proxy',
          requiresToken: false,
        });
      }
    } finally {
      setIsLoading(false);
    }
  }, [channel, enabled]);

  /**
   * Manual retry
   */
  const retry = useCallback(() => {
    retryAttempts.current = 0;
    fetchPlaybackUrl();
  }, [fetchPlaybackUrl]);

  // Fetch URL when channel changes
  useEffect(() => {
    fetchPlaybackUrl();

    return () => {
      if (tokenRefreshTimer.current) {
        clearTimeout(tokenRefreshTimer.current);
      }
    };
  }, [fetchPlaybackUrl]);

  return {
    playbackUrl: playbackResult?.url || null,
    source: playbackResult?.source || null,
    isLoading,
    error,
    fallbackUrl: playbackResult?.fallbackUrl || null,
    requiresToken: playbackResult?.requiresToken || false,
    retry,
  };
}

export default useCdnPlayer;
