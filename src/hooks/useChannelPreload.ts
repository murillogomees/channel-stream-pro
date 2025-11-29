/**
 * ============================================================================
 * Channel Preload Hook - Performance Optimization
 * ============================================================================
 * 
 * Pré-carrega o próximo canal em background para início instantâneo.
 * - Prefetch de manifesto HLS
 * - Cache de thumbnails/logos
 * - Preconnect para domínios de stream
 */

import { useCallback, useRef, useEffect } from 'react';

interface PreloadableChannel {
  id: string;
  name: string;
  stream_url: string;
  tvg_logo?: string | null;
}

interface PreloadCache {
  manifestUrl: string;
  preloadedAt: number;
  abortController?: AbortController;
}

// Cache de manifestos pré-carregados (em memória)
const preloadCache = new Map<string, PreloadCache>();
const MAX_CACHE_SIZE = 5;
const CACHE_TTL = 60000; // 1 minuto

// Domínios já conectados
const connectedDomains = new Set<string>();

export function useChannelPreload() {
  const preloadTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Limpar cache expirado
  const cleanExpiredCache = useCallback(() => {
    const now = Date.now();
    for (const [key, value] of preloadCache.entries()) {
      if (now - value.preloadedAt > CACHE_TTL) {
        preloadCache.delete(key);
      }
    }
  }, []);

  // Extrair domínio de URL
  const extractDomain = useCallback((url: string): string | null => {
    try {
      const urlObj = new URL(url);
      return urlObj.origin;
    } catch {
      return null;
    }
  }, []);

  // Preconnect para domínio de stream
  const preconnectToDomain = useCallback((url: string) => {
    const domain = extractDomain(url);
    if (!domain || connectedDomains.has(domain)) return;

    // Verificar se já existe link de preconnect
    const existingLink = document.querySelector(`link[rel="preconnect"][href="${domain}"]`);
    if (existingLink) {
      connectedDomains.add(domain);
      return;
    }

    // Criar preconnect link
    const link = document.createElement('link');
    link.rel = 'preconnect';
    link.href = domain;
    link.crossOrigin = 'anonymous';
    document.head.appendChild(link);

    // DNS prefetch também
    const dnsLink = document.createElement('link');
    dnsLink.rel = 'dns-prefetch';
    dnsLink.href = domain;
    document.head.appendChild(dnsLink);

    connectedDomains.add(domain);
    console.log('[Preload] Preconnected to:', domain);
  }, [extractDomain]);

  // Preload de thumbnail/logo
  const preloadImage = useCallback((imageUrl: string | null | undefined) => {
    if (!imageUrl) return;

    // Verificar se já está em cache do browser
    const img = new Image();
    img.decoding = 'async';
    img.loading = 'eager';
    img.src = imageUrl;
  }, []);

  // Prefetch de manifesto HLS
  const prefetchManifest = useCallback(async (streamUrl: string): Promise<boolean> => {
    // Já está em cache?
    const cached = preloadCache.get(streamUrl);
    if (cached && Date.now() - cached.preloadedAt < CACHE_TTL) {
      console.log('[Preload] Manifest already cached:', streamUrl.substring(0, 50));
      return true;
    }

    // Limitar tamanho do cache
    if (preloadCache.size >= MAX_CACHE_SIZE) {
      cleanExpiredCache();
      if (preloadCache.size >= MAX_CACHE_SIZE) {
        const oldest = Array.from(preloadCache.entries())
          .sort((a, b) => a[1].preloadedAt - b[1].preloadedAt)[0];
        if (oldest) {
          oldest[1].abortController?.abort();
          preloadCache.delete(oldest[0]);
        }
      }
    }

    const abortController = new AbortController();
    
    try {
      // Preconnect primeiro
      preconnectToDomain(streamUrl);

      // Fetch com low priority para não impactar playback atual
      const response = await fetch(streamUrl, {
        method: 'GET',
        signal: abortController.signal,
        // @ts-ignore - priority é suportado em browsers modernos
        priority: 'low',
        headers: {
          'Accept': 'application/vnd.apple.mpegurl, application/x-mpegurl, */*',
        },
      });

      if (response.ok) {
        // Ler corpo para garantir cache
        await response.text();
        
        preloadCache.set(streamUrl, {
          manifestUrl: streamUrl,
          preloadedAt: Date.now(),
          abortController,
        });

        console.log('[Preload] Manifest prefetched:', streamUrl.substring(0, 50));
        return true;
      }
    } catch (error) {
      if ((error as Error).name !== 'AbortError') {
        console.warn('[Preload] Failed to prefetch manifest:', error);
      }
    }

    return false;
  }, [cleanExpiredCache, preconnectToDomain]);

  // Preload completo de um canal
  const preloadChannel = useCallback(async (channel: PreloadableChannel) => {
    console.log('[Preload] Starting preload for:', channel.name);

    // 1. Preconnect ao domínio do stream
    preconnectToDomain(channel.stream_url);

    // 2. Preload da logo/thumbnail
    preloadImage(channel.tvg_logo);

    // 3. Prefetch do manifesto (se for HLS)
    const isHls = channel.stream_url.toLowerCase().includes('.m3u8') || 
                  channel.stream_url.toLowerCase().includes('.m3u');
    
    if (isHls) {
      await prefetchManifest(channel.stream_url);
    }
  }, [preconnectToDomain, preloadImage, prefetchManifest]);

  // Preload do próximo canal com delay
  const preloadNextChannel = useCallback((channel: PreloadableChannel, delayMs = 500) => {
    // Cancelar preload anterior
    if (preloadTimeoutRef.current) {
      clearTimeout(preloadTimeoutRef.current);
    }

    // Agendar preload com delay para não competir com playback atual
    preloadTimeoutRef.current = setTimeout(() => {
      preloadChannel(channel);
    }, delayMs);
  }, [preloadChannel]);

  // Preload de múltiplos canais (próximos na lista)
  const preloadChannels = useCallback((channels: PreloadableChannel[], count = 2) => {
    const toPreload = channels.slice(0, count);
    
    toPreload.forEach((channel, index) => {
      // Delay escalonado para não sobrecarregar
      setTimeout(() => {
        preloadChannel(channel);
      }, index * 1000);
    });
  }, [preloadChannel]);

  // Verificar se canal está pré-carregado
  const isPreloaded = useCallback((streamUrl: string): boolean => {
    const cached = preloadCache.get(streamUrl);
    return !!(cached && Date.now() - cached.preloadedAt < CACHE_TTL);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (preloadTimeoutRef.current) {
        clearTimeout(preloadTimeoutRef.current);
      }
      // Cancelar fetches pendentes
      for (const cache of preloadCache.values()) {
        cache.abortController?.abort();
      }
    };
  }, []);

  return {
    preloadChannel,
    preloadNextChannel,
    preloadChannels,
    preconnectToDomain,
    isPreloaded,
  };
}

export default useChannelPreload;
