/**
 * useSignedStreamUrl - Hook para obter URLs assinadas do Cloudflare Stream
 * 
 * Gerencia:
 * - Geração automática de URLs assinadas para VOD
 * - Cache local para evitar chamadas repetidas
 * - Fallback para URL não assinada em caso de erro
 * - Renovação automática antes da expiração
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { getSignedPlaybackUrl, SignedPlaybackUrl } from '@/services/cloudflareStreamService';

interface UseSignedStreamUrlOptions {
  /** UID do Cloudflare Stream */
  cfStreamUid: string | null;
  /** URL fallback original */
  fallbackUrl?: string;
  /** Tempo de expiração em segundos (default: 1 hora) */
  expiresInSeconds?: number;
  /** Margem de renovação antes da expiração (default: 5 minutos) */
  renewalMarginSeconds?: number;
  /** Habilitar assinatura (default: true) */
  enabled?: boolean;
}

interface UseSignedStreamUrlReturn {
  /** URL para playback (assinada ou fallback) */
  url: string | null;
  /** Se a URL está assinada */
  isSigned: boolean;
  /** Se está carregando */
  isLoading: boolean;
  /** Erro se houver */
  error: string | null;
  /** Timestamp de expiração */
  expiresAt: number | null;
  /** Fonte da URL */
  source: 'signed' | 'unsigned' | 'fallback' | 'none';
  /** Forçar renovação da URL */
  refresh: () => Promise<void>;
}

// Cache global para URLs assinadas
const signedUrlCache = new Map<string, {
  url: string;
  expiresAt: number;
  isSigned: boolean;
}>();

export function useSignedStreamUrl({
  cfStreamUid,
  fallbackUrl,
  expiresInSeconds = 3600,
  renewalMarginSeconds = 300,
  enabled = true,
}: UseSignedStreamUrlOptions): UseSignedStreamUrlReturn {
  const [url, setUrl] = useState<string | null>(null);
  const [isSigned, setIsSigned] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<number | null>(null);
  const [source, setSource] = useState<UseSignedStreamUrlReturn['source']>('none');
  
  const renewalTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);

  const fetchSignedUrl = useCallback(async (forceRefresh = false) => {
    if (!cfStreamUid || !enabled) {
      if (fallbackUrl) {
        setUrl(fallbackUrl);
        setSource('fallback');
        setIsSigned(false);
      }
      return;
    }

    // Check cache first (unless forcing refresh)
    if (!forceRefresh) {
      const cached = signedUrlCache.get(cfStreamUid);
      if (cached) {
        const now = Math.floor(Date.now() / 1000);
        const timeUntilExpiry = cached.expiresAt - now;
        
        // Use cached if not expired and has margin left
        if (timeUntilExpiry > renewalMarginSeconds) {
          console.log('[SignedURL] Using cached URL, expires in', timeUntilExpiry, 's');
          setUrl(cached.url);
          setIsSigned(cached.isSigned);
          setExpiresAt(cached.expiresAt);
          setSource(cached.isSigned ? 'signed' : 'unsigned');
          setError(null);
          
          // Schedule renewal
          scheduleRenewal(timeUntilExpiry - renewalMarginSeconds);
          return;
        }
      }
    }

    setIsLoading(true);
    setError(null);

    try {
      console.log('[SignedURL] Fetching signed URL for', cfStreamUid);
      const result = await getSignedPlaybackUrl(cfStreamUid, expiresInSeconds);
      
      if (!mountedRef.current) return;

      if (result) {
        // Update state
        setUrl(result.url);
        setIsSigned(result.signed);
        setExpiresAt(result.expiresAt || null);
        setSource(result.signed ? 'signed' : 'unsigned');
        
        // Update cache
        signedUrlCache.set(cfStreamUid, {
          url: result.url,
          expiresAt: result.expiresAt || Math.floor(Date.now() / 1000) + expiresInSeconds,
          isSigned: result.signed,
        });

        // Schedule renewal if signed
        if (result.signed && result.expiresAt) {
          const timeUntilExpiry = result.expiresAt - Math.floor(Date.now() / 1000);
          scheduleRenewal(timeUntilExpiry - renewalMarginSeconds);
        }

        console.log('[SignedURL] Got URL:', result.signed ? 'signed' : 'unsigned');
      } else {
        // Use fallback
        if (fallbackUrl) {
          setUrl(fallbackUrl);
          setSource('fallback');
        }
        setError('Falha ao gerar URL assinada');
      }
    } catch (err) {
      console.error('[SignedURL] Error:', err);
      if (!mountedRef.current) return;
      
      setError(err instanceof Error ? err.message : 'Erro desconhecido');
      
      // Use fallback on error
      if (fallbackUrl) {
        setUrl(fallbackUrl);
        setSource('fallback');
      }
    } finally {
      if (mountedRef.current) {
        setIsLoading(false);
      }
    }
  }, [cfStreamUid, fallbackUrl, expiresInSeconds, renewalMarginSeconds, enabled]);

  const scheduleRenewal = useCallback((delaySeconds: number) => {
    if (renewalTimerRef.current) {
      clearTimeout(renewalTimerRef.current);
    }
    
    if (delaySeconds > 0) {
      console.log('[SignedURL] Scheduling renewal in', delaySeconds, 's');
      renewalTimerRef.current = setTimeout(() => {
        console.log('[SignedURL] Auto-renewing URL');
        fetchSignedUrl(true);
      }, delaySeconds * 1000);
    }
  }, [fetchSignedUrl]);

  const refresh = useCallback(async () => {
    await fetchSignedUrl(true);
  }, [fetchSignedUrl]);

  // Fetch on mount and when cfStreamUid changes
  useEffect(() => {
    mountedRef.current = true;
    fetchSignedUrl();

    return () => {
      mountedRef.current = false;
      if (renewalTimerRef.current) {
        clearTimeout(renewalTimerRef.current);
      }
    };
  }, [fetchSignedUrl]);

  return {
    url,
    isSigned,
    isLoading,
    error,
    expiresAt,
    source,
    refresh,
  };
}

/**
 * Limpa o cache de URLs assinadas
 */
export function clearSignedUrlCache(cfStreamUid?: string): void {
  if (cfStreamUid) {
    signedUrlCache.delete(cfStreamUid);
  } else {
    signedUrlCache.clear();
  }
}

/**
 * Pré-carrega URL assinada para um UID
 */
export async function preloadSignedUrl(
  cfStreamUid: string,
  expiresInSeconds: number = 3600
): Promise<SignedPlaybackUrl | null> {
  try {
    const result = await getSignedPlaybackUrl(cfStreamUid, expiresInSeconds);
    if (result) {
      signedUrlCache.set(cfStreamUid, {
        url: result.url,
        expiresAt: result.expiresAt || Math.floor(Date.now() / 1000) + expiresInSeconds,
        isSigned: result.signed,
      });
    }
    return result;
  } catch {
    return null;
  }
}
