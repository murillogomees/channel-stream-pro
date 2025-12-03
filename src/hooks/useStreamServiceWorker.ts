/**
 * useStreamServiceWorker - Hook para gerenciar Service Worker de cache de streams
 */

import { useState, useEffect, useCallback, useRef } from 'react';

interface CacheStats {
  manifests: number;
  segments: number;
  totalItems: number;
  totalSize: number;
  totalSizeMB: string;
}

interface UseStreamServiceWorkerReturn {
  isRegistered: boolean;
  isSupported: boolean;
  stats: CacheStats | null;
  prefetch: (url: string) => Promise<boolean>;
  prefetchBatch: (urls: string[]) => Promise<boolean>;
  clearCache: () => Promise<boolean>;
  refreshStats: () => Promise<void>;
}

export function useStreamServiceWorker(): UseStreamServiceWorkerReturn {
  const [isRegistered, setIsRegistered] = useState(false);
  const [stats, setStats] = useState<CacheStats | null>(null);
  const registrationRef = useRef<ServiceWorkerRegistration | null>(null);
  
  const isSupported = typeof navigator !== 'undefined' && 'serviceWorker' in navigator;

  // Registra Service Worker
  useEffect(() => {
    if (!isSupported) return;
    
    const register = async () => {
      try {
        // Verifica se já está registrado
        const registrations = await navigator.serviceWorker.getRegistrations();
        const existing = registrations.find(r => 
          r.active?.scriptURL.includes('stream-cache-sw.js')
        );
        
        if (existing) {
          registrationRef.current = existing;
          setIsRegistered(true);
          console.log('[StreamSW] Service Worker já registrado');
          return;
        }
        
        // Registra novo
        const registration = await navigator.serviceWorker.register('/stream-cache-sw.js', {
          scope: '/',
        });
        
        registrationRef.current = registration;
        setIsRegistered(true);
        console.log('[StreamSW] Service Worker registrado');
        
        // Aguarda ativação
        if (registration.installing) {
          registration.installing.addEventListener('statechange', (e) => {
            if ((e.target as ServiceWorker).state === 'activated') {
              console.log('[StreamSW] Service Worker ativado');
            }
          });
        }
      } catch (error) {
        console.error('[StreamSW] Erro ao registrar:', error);
      }
    };
    
    register();
    
    return () => {
      // Não desregistra no unmount para manter cache
    };
  }, [isSupported]);

  // Envia mensagem para o Service Worker
  const sendMessage = useCallback((message: any): Promise<any> => {
    return new Promise((resolve, reject) => {
      if (!navigator.serviceWorker.controller) {
        reject(new Error('Service Worker não ativo'));
        return;
      }
      
      const messageChannel = new MessageChannel();
      
      messageChannel.port1.onmessage = (event) => {
        resolve(event.data);
      };
      
      navigator.serviceWorker.controller.postMessage(message, [messageChannel.port2]);
      
      // Timeout
      setTimeout(() => reject(new Error('Timeout')), 10000);
    });
  }, []);

  // Prefetch de URL
  const prefetch = useCallback(async (url: string): Promise<boolean> => {
    if (!isRegistered || !navigator.serviceWorker.controller) {
      // Fallback: fetch normal com cache
      try {
        await fetch(url, { cache: 'force-cache' });
        return true;
      } catch {
        return false;
      }
    }
    
    try {
      const result = await sendMessage({ type: 'PREFETCH', payload: { url } });
      return result.success;
    } catch {
      return false;
    }
  }, [isRegistered, sendMessage]);

  // Prefetch batch
  const prefetchBatch = useCallback(async (urls: string[]): Promise<boolean> => {
    if (!isRegistered || !navigator.serviceWorker.controller) {
      // Fallback: fetch paralelo
      try {
        await Promise.all(urls.map(url => fetch(url, { cache: 'force-cache' })));
        return true;
      } catch {
        return false;
      }
    }
    
    try {
      const result = await sendMessage({ type: 'PREFETCH_BATCH', payload: { urls } });
      return result.success;
    } catch {
      return false;
    }
  }, [isRegistered, sendMessage]);

  // Limpa cache
  const clearCache = useCallback(async (): Promise<boolean> => {
    if (!isRegistered || !navigator.serviceWorker.controller) {
      return false;
    }
    
    try {
      const result = await sendMessage({ type: 'CLEAR_CACHE' });
      setStats(null);
      return result.success;
    } catch {
      return false;
    }
  }, [isRegistered, sendMessage]);

  // Atualiza estatísticas
  const refreshStats = useCallback(async (): Promise<void> => {
    if (!isRegistered || !navigator.serviceWorker.controller) {
      return;
    }
    
    try {
      const result = await sendMessage({ type: 'GET_STATS' });
      if (!result.error) {
        setStats(result);
      }
    } catch {
      // Ignora erro
    }
  }, [isRegistered, sendMessage]);

  // Atualiza stats periodicamente
  useEffect(() => {
    if (!isRegistered) return;
    
    // Stats inicial
    refreshStats();
    
    // Atualiza a cada 30 segundos
    const interval = setInterval(refreshStats, 30000);
    
    return () => clearInterval(interval);
  }, [isRegistered, refreshStats]);

  return {
    isRegistered,
    isSupported,
    stats,
    prefetch,
    prefetchBatch,
    clearCache,
    refreshStats,
  };
}

export default useStreamServiceWorker;
