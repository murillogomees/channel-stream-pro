/**
 * useWorkerPreloader - Preload de streams usando Web Worker
 * Executa em thread separada para não bloquear UI
 */

import { useEffect, useRef, useCallback, useState } from 'react';

interface PreloadResult {
  id: string;
  url: string;
  success: boolean;
  data?: string;
  size?: number;
  duration?: number;
  error?: string;
}

interface WorkerStats {
  queueSize: number;
  manifestCacheSize: number;
  segmentCacheSize: number;
  activeRequests: number;
}

interface UseWorkerPreloaderOptions {
  enabled?: boolean;
  onPreloadComplete?: (result: PreloadResult) => void;
}

export function useWorkerPreloader(options: UseWorkerPreloaderOptions = {}) {
  const { enabled = true, onPreloadComplete } = options;
  
  const workerRef = useRef<Worker | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [stats, setStats] = useState<WorkerStats>({
    queueSize: 0,
    manifestCacheSize: 0,
    segmentCacheSize: 0,
    activeRequests: 0,
  });
  
  const pendingCallbacks = useRef<Map<string, (result: PreloadResult) => void>>(new Map());
  const cachedManifests = useRef<Map<string, string>>(new Map());

  // Inicializa worker
  useEffect(() => {
    if (!enabled) return;
    
    // Verifica suporte a workers
    if (typeof Worker === 'undefined') {
      console.warn('[WorkerPreloader] Web Workers não suportados');
      return;
    }
    
    try {
      // Cria worker inline usando Blob para compatibilidade
      const workerCode = `
        const manifestCache = new Map();
        const segmentCache = new Map();
        const CACHE_TTL = 30000;
        const queue = [];
        let isProcessing = false;
        const MAX_CONCURRENT = 4;
        let activeRequests = 0;

        function cleanExpiredCache() {
          const now = Date.now();
          manifestCache.forEach((entry, url) => {
            if (now - entry.timestamp > CACHE_TTL) manifestCache.delete(url);
          });
          segmentCache.forEach((entry, url) => {
            if (now - entry.timestamp > CACHE_TTL) segmentCache.delete(url);
          });
        }

        async function processTask(task) {
          const startTime = performance.now();
          try {
            if (task.type === 'manifest' && manifestCache.has(task.url)) {
              const cached = manifestCache.get(task.url);
              if (Date.now() - cached.timestamp < CACHE_TTL) {
                return { id: task.id, url: task.url, success: true, data: cached.data, duration: 0 };
              }
            }
            
            const controller = new AbortController();
            const timeout = task.type === 'manifest' ? 5000 : 8000;
            const timeoutId = setTimeout(() => controller.abort(), timeout);
            
            const response = await fetch(task.url, {
              signal: controller.signal,
              cache: 'force-cache',
            });
            clearTimeout(timeoutId);
            
            if (!response.ok) throw new Error('HTTP ' + response.status);
            
            const duration = performance.now() - startTime;
            
            if (task.type === 'manifest') {
              const data = await response.text();
              manifestCache.set(task.url, { data, timestamp: Date.now() });
              return { id: task.id, url: task.url, success: true, data, size: data.length, duration };
            } else {
              const size = parseInt(response.headers.get('content-length') || '0', 10);
              segmentCache.set(task.url, { size, timestamp: Date.now() });
              return { id: task.id, url: task.url, success: true, size, duration };
            }
          } catch (error) {
            return { id: task.id, url: task.url, success: false, error: error.message, duration: performance.now() - startTime };
          }
        }

        async function processQueue() {
          if (isProcessing || queue.length === 0) return;
          isProcessing = true;
          cleanExpiredCache();
          
          queue.sort((a, b) => {
            const priority = { high: 0, medium: 1, low: 2 };
            return priority[a.priority] - priority[b.priority];
          });
          
          while (queue.length > 0 && activeRequests < MAX_CONCURRENT) {
            const task = queue.shift();
            if (!task) break;
            activeRequests++;
            processTask(task).then(result => {
              self.postMessage({ type: 'result', payload: result });
            }).finally(() => {
              activeRequests--;
              if (queue.length > 0) processQueue();
            });
          }
          isProcessing = false;
        }

        self.onmessage = (event) => {
          const { type, payload } = event.data;
          switch (type) {
            case 'preload':
              queue.push(payload);
              processQueue();
              break;
            case 'preloadBatch':
              queue.push(...payload);
              processQueue();
              break;
            case 'cancel':
              const idx = queue.findIndex(t => t.url === payload.url);
              if (idx !== -1) queue.splice(idx, 1);
              break;
            case 'clear':
              queue.length = 0;
              manifestCache.clear();
              segmentCache.clear();
              break;
            case 'getStats':
              self.postMessage({ type: 'stats', payload: { queueSize: queue.length, manifestCacheSize: manifestCache.size, segmentCacheSize: segmentCache.size, activeRequests } });
              break;
            case 'getCached':
              const cached = manifestCache.get(payload.url);
              self.postMessage({ type: 'cached', payload: { url: payload.url, exists: !!cached, data: cached?.data } });
              break;
          }
        };
        self.postMessage({ type: 'ready' });
      `;
      
      const blob = new Blob([workerCode], { type: 'application/javascript' });
      const workerUrl = URL.createObjectURL(blob);
      
      workerRef.current = new Worker(workerUrl);
      
      workerRef.current.onmessage = (event) => {
        const { type, payload } = event.data;
        
        switch (type) {
          case 'ready':
            setIsReady(true);
            console.log('[WorkerPreloader] Worker pronto');
            break;
            
          case 'result':
            const result = payload as PreloadResult;
            
            // Armazena manifesto cacheado
            if (result.success && result.data) {
              cachedManifests.current.set(result.url, result.data);
            }
            
            // Executa callback
            const callback = pendingCallbacks.current.get(result.id);
            if (callback) {
              callback(result);
              pendingCallbacks.current.delete(result.id);
            }
            
            onPreloadComplete?.(result);
            break;
            
          case 'stats':
            setStats(payload as WorkerStats);
            break;
            
          case 'cached':
            if (payload.exists && payload.data) {
              cachedManifests.current.set(payload.url, payload.data);
            }
            break;
        }
      };
      
      workerRef.current.onerror = (error) => {
        console.error('[WorkerPreloader] Worker error:', error);
      };
      
      return () => {
        if (workerRef.current) {
          workerRef.current.terminate();
          workerRef.current = null;
        }
        URL.revokeObjectURL(workerUrl);
      };
    } catch (error) {
      console.error('[WorkerPreloader] Falha ao criar worker:', error);
    }
  }, [enabled, onPreloadComplete]);

  // Preload de manifesto
  const preloadManifest = useCallback((
    url: string,
    priority: 'high' | 'medium' | 'low' = 'medium'
  ): Promise<PreloadResult> => {
    return new Promise((resolve) => {
      if (!workerRef.current || !isReady) {
        resolve({ id: '', url, success: false, error: 'Worker not ready' });
        return;
      }
      
      // Verifica cache local primeiro
      if (cachedManifests.current.has(url)) {
        resolve({
          id: url,
          url,
          success: true,
          data: cachedManifests.current.get(url),
          duration: 0,
        });
        return;
      }
      
      const id = `${url}_${Date.now()}`;
      
      pendingCallbacks.current.set(id, resolve);
      
      workerRef.current.postMessage({
        type: 'preload',
        payload: { id, url, priority, type: 'manifest' },
      });
    });
  }, [isReady]);

  // Preload batch de URLs
  const preloadBatch = useCallback((
    urls: Array<{ url: string; priority: 'high' | 'medium' | 'low' }>
  ): void => {
    if (!workerRef.current || !isReady) return;
    
    const tasks = urls
      .filter(u => !cachedManifests.current.has(u.url))
      .map(u => ({
        id: `${u.url}_${Date.now()}`,
        url: u.url,
        priority: u.priority,
        type: 'manifest' as const,
      }));
    
    if (tasks.length > 0) {
      workerRef.current.postMessage({
        type: 'preloadBatch',
        payload: tasks,
      });
    }
  }, [isReady]);

  // Verifica se URL está cacheada
  const isCached = useCallback((url: string): boolean => {
    return cachedManifests.current.has(url);
  }, []);

  // Obtém manifesto cacheado
  const getCachedManifest = useCallback((url: string): string | null => {
    return cachedManifests.current.get(url) || null;
  }, []);

  // Limpa cache
  const clearCache = useCallback(() => {
    if (workerRef.current) {
      workerRef.current.postMessage({ type: 'clear' });
    }
    cachedManifests.current.clear();
  }, []);

  // Obtém estatísticas
  const getStats = useCallback(() => {
    if (workerRef.current && isReady) {
      workerRef.current.postMessage({ type: 'getStats' });
    }
    return stats;
  }, [isReady, stats]);

  return {
    isReady,
    stats,
    preloadManifest,
    preloadBatch,
    isCached,
    getCachedManifest,
    clearCache,
    getStats,
  };
}

export default useWorkerPreloader;
