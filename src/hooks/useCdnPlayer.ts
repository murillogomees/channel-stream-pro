/**
 * useCdnPlayer - Hook for CDN-aware video playback
 * 
 * ARQUITETURA DE ENTREGA:
 * - TV AO VIVO: Link direto (sem proxy, sem CDN)
 * - VOD: R2 Cloudflare CDN
 * - Cloudflare Stream: Para conteúdo transcodificado
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { streamService, Channel, PlaybackSource } from '@/modules/player/services/StreamService';

interface UseCdnPlayerOptions {
  channel: Channel | null;
  enabled?: boolean;
}

interface UseCdnPlayerReturn {
  playbackUrl: string | null;
  source: PlaybackSource['source'] | null;
  isLoading: boolean;
  error: string | null;
  fallbackUrl: string | null;
  isLive: boolean;
  isVod: boolean;
  retry: () => void;
}

export function useCdnPlayer({ 
  channel, 
  enabled = true 
}: UseCdnPlayerOptions): UseCdnPlayerReturn {
  const [playbackSource, setPlaybackSource] = useState<PlaybackSource | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const retryAttempts = useRef(0);
  const maxRetries = 2;

  /**
   * Resolve playback URL based on content type
   */
  const resolvePlaybackUrl = useCallback(() => {
    if (!channel || !enabled) {
      setPlaybackSource(null);
      setError(null);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Use StreamService to get optimized playback source
      const source = streamService.getPlaybackSource(channel);
      
      if (!source.url) {
        throw new Error('No playback URL available');
      }

      setPlaybackSource(source);
      retryAttempts.current = 0;

      console.log('[CDN Player] Playback resolved:', {
        channel: channel.name,
        source: source.source,
        isLive: streamService.isLiveContent(channel),
        isVod: streamService.isVodContent(channel),
        url: source.url.substring(0, 60) + '...',
      });

    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to resolve playback URL';
      console.error('[CDN Player] Error:', errorMsg);
      setError(errorMsg);

      // Retry with fallback
      if (retryAttempts.current < maxRetries && channel.stream_url) {
        retryAttempts.current++;
        console.log(`[CDN Player] Retrying with direct URL... (${retryAttempts.current}/${maxRetries})`);
        
        // Fallback to direct URL
        setPlaybackSource({
          url: channel.stream_url,
          source: 'direct',
          requiresAuth: false,
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
    resolvePlaybackUrl();
  }, [resolvePlaybackUrl]);

  // Resolve URL when channel changes
  useEffect(() => {
    resolvePlaybackUrl();
  }, [resolvePlaybackUrl]);

  return {
    playbackUrl: playbackSource?.url || null,
    source: playbackSource?.source || null,
    isLoading,
    error,
    fallbackUrl: playbackSource?.fallbackUrl || channel?.stream_url || null,
    isLive: channel ? streamService.isLiveContent(channel) : false,
    isVod: channel ? streamService.isVodContent(channel) : false,
    retry,
  };
}

export default useCdnPlayer;
