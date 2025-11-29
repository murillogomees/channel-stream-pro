/**
 * useStreamPreloader - Preload inteligente de streams
 * Carrega manifesto e primeiros fragmentos do próximo canal
 */

import { useRef, useCallback, useEffect } from 'react';
import Hls from 'hls.js';

interface PreloadItem {
  url: string;
  hls: Hls | null;
  video: HTMLVideoElement | null;
  ready: boolean;
  timestamp: number;
}

interface UseStreamPreloaderOptions {
  /** Máximo de streams para manter em preload */
  maxPreloads?: number;
  /** TTL do preload em ms */
  preloadTTL?: number;
  /** Preload apenas manifesto (sem fragmentos) */
  manifestOnly?: boolean;
}

export function useStreamPreloader(options: UseStreamPreloaderOptions = {}) {
  const {
    maxPreloads = 2,
    preloadTTL = 30000, // 30 segundos
    manifestOnly = false,
  } = options;

  const preloadsRef = useRef<Map<string, PreloadItem>>(new Map());
  const cleanupTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  /**
   * Preload de um stream
   */
  const preload = useCallback((url: string): Promise<boolean> => {
    return new Promise((resolve) => {
      if (!Hls.isSupported()) {
        resolve(false);
        return;
      }

      // Já existe preload?
      if (preloadsRef.current.has(url)) {
        const existing = preloadsRef.current.get(url)!;
        existing.timestamp = Date.now(); // Refresh TTL
        resolve(existing.ready);
        return;
      }

      // Limite de preloads
      if (preloadsRef.current.size >= maxPreloads) {
        // Remove o mais antigo
        const oldest = Array.from(preloadsRef.current.entries())
          .sort((a, b) => a[1].timestamp - b[1].timestamp)[0];
        if (oldest) {
          cancelPreload(oldest[0]);
        }
      }

      console.log('[Preloader] Starting preload:', url.substring(0, 50) + '...');

      // Cria video element oculto
      const video = document.createElement('video');
      video.muted = true;
      video.preload = 'metadata';
      video.style.display = 'none';

      // Cria HLS instance com config mínima
      const hls = new Hls({
        enableWorker: true,
        // Carrega apenas o necessário
        maxBufferLength: manifestOnly ? 0 : 5,
        maxMaxBufferLength: manifestOnly ? 0 : 10,
        maxBufferSize: manifestOnly ? 0 : 5 * 1000 * 1000,
        startLevel: 0, // Começa no mais baixo
        // Não faz retry agressivo
        fragLoadingMaxRetry: 1,
        manifestLoadingMaxRetry: 2,
        // Timeouts curtos
        fragLoadingTimeOut: 10000,
        manifestLoadingTimeOut: 5000,
      });

      const item: PreloadItem = {
        url,
        hls,
        video,
        ready: false,
        timestamp: Date.now(),
      };

      preloadsRef.current.set(url, item);

      hls.loadSource(url);
      hls.attachMedia(video);

      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        console.log('[Preloader] Manifest ready:', url.substring(0, 50) + '...');
        item.ready = true;
        
        if (manifestOnly) {
          hls.stopLoad();
        }
        
        resolve(true);
      });

      hls.on(Hls.Events.ERROR, (_, data) => {
        if (data.fatal) {
          console.warn('[Preloader] Preload failed:', url.substring(0, 50) + '...');
          cancelPreload(url);
          resolve(false);
        }
      });

      // Timeout
      setTimeout(() => {
        if (!item.ready) {
          console.warn('[Preloader] Preload timeout:', url.substring(0, 50) + '...');
          cancelPreload(url);
          resolve(false);
        }
      }, 15000);
    });
  }, [maxPreloads, manifestOnly]);

  /**
   * Cancela preload de um stream
   */
  const cancelPreload = useCallback((url: string) => {
    const item = preloadsRef.current.get(url);
    if (item) {
      if (item.hls) {
        item.hls.destroy();
      }
      if (item.video) {
        item.video.src = '';
        item.video.remove();
      }
      preloadsRef.current.delete(url);
      console.log('[Preloader] Cancelled preload:', url.substring(0, 50) + '...');
    }
  }, []);

  /**
   * Obtém HLS instance preloaded (para reutilização)
   */
  const getPreloaded = useCallback((url: string): Hls | null => {
    const item = preloadsRef.current.get(url);
    if (item?.ready && item.hls) {
      // Remove do cache mas retorna a instância
      preloadsRef.current.delete(url);
      if (item.video) {
        item.video.remove();
      }
      console.log('[Preloader] Using preloaded HLS instance');
      return item.hls;
    }
    return null;
  }, []);

  /**
   * Verifica se URL está preloaded
   */
  const isPreloaded = useCallback((url: string): boolean => {
    const item = preloadsRef.current.get(url);
    return item?.ready ?? false;
  }, []);

  /**
   * Limpa todos os preloads
   */
  const clearAll = useCallback(() => {
    for (const [url] of preloadsRef.current) {
      cancelPreload(url);
    }
  }, [cancelPreload]);

  // Cleanup automático de preloads expirados
  useEffect(() => {
    cleanupTimerRef.current = setInterval(() => {
      const now = Date.now();
      for (const [url, item] of preloadsRef.current) {
        if (now - item.timestamp > preloadTTL) {
          console.log('[Preloader] TTL expired:', url.substring(0, 50) + '...');
          cancelPreload(url);
        }
      }
    }, 10000);

    return () => {
      if (cleanupTimerRef.current) {
        clearInterval(cleanupTimerRef.current);
      }
      clearAll();
    };
  }, [preloadTTL, cancelPreload, clearAll]);

  return {
    preload,
    cancelPreload,
    getPreloaded,
    isPreloaded,
    clearAll,
    preloadCount: preloadsRef.current.size,
  };
}

export default useStreamPreloader;
