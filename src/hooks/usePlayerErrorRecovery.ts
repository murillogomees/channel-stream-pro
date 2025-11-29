/**
 * usePlayerErrorRecovery - Recovery avançado com backoff exponencial
 */

import { useRef, useCallback } from 'react';
import Hls from 'hls.js';

interface ErrorStats {
  networkErrors: number;
  mediaErrors: number;
  otherErrors: number;
  lastErrorTime: number;
  consecutiveErrors: number;
}

interface UsePlayerErrorRecoveryOptions {
  /** Max tentativas para erros de rede */
  maxNetworkRetries?: number;
  /** Max tentativas para erros de mídia */
  maxMediaRetries?: number;
  /** Delay inicial em ms */
  initialDelay?: number;
  /** Max delay em ms */
  maxDelay?: number;
  /** Callback quando todas as tentativas falharem */
  onFatalError?: (error: { type: string; details: string }) => void;
  /** Callback para fallback URL */
  onFallback?: () => void;
}

export function usePlayerErrorRecovery(options: UsePlayerErrorRecoveryOptions = {}) {
  const {
    maxNetworkRetries = 6,
    maxMediaRetries = 3,
    initialDelay = 1000,
    maxDelay = 30000,
    onFatalError,
    onFallback,
  } = options;

  const statsRef = useRef<ErrorStats>({
    networkErrors: 0,
    mediaErrors: 0,
    otherErrors: 0,
    lastErrorTime: 0,
    consecutiveErrors: 0,
  });

  const isRecoveringRef = useRef(false);

  /**
   * Calcula delay com backoff exponencial
   */
  const getBackoffDelay = useCallback((attempts: number): number => {
    const delay = initialDelay * Math.pow(2, attempts - 1);
    // Adiciona jitter para evitar thundering herd
    const jitter = delay * 0.2 * Math.random();
    return Math.min(delay + jitter, maxDelay);
  }, [initialDelay, maxDelay]);

  /**
   * Reset stats (chamar quando playback inicia com sucesso)
   */
  const resetStats = useCallback(() => {
    statsRef.current = {
      networkErrors: 0,
      mediaErrors: 0,
      otherErrors: 0,
      lastErrorTime: 0,
      consecutiveErrors: 0,
    };
    isRecoveringRef.current = false;
    console.log('[Recovery] Stats reset');
  }, []);

  /**
   * Handle HLS error com recovery inteligente
   */
  const handleHlsError = useCallback((
    hls: Hls,
    data: { type: string; details: string; fatal: boolean; response?: { code: number } }
  ): boolean => {
    const stats = statsRef.current;
    const now = Date.now();

    // Se erro ocorreu há mais de 30s, reseta contador de consecutivos
    if (now - stats.lastErrorTime > 30000) {
      stats.consecutiveErrors = 0;
    }

    stats.lastErrorTime = now;
    stats.consecutiveErrors++;

    console.log('[Recovery] Error:', data.type, data.details, 'Fatal:', data.fatal);

    if (!data.fatal) {
      // Erros não-fatais: HLS.js lida automaticamente
      return true;
    }

    // Evita recovery simultâneo
    if (isRecoveringRef.current) {
      console.log('[Recovery] Already recovering, skipping...');
      return true;
    }

    isRecoveringRef.current = true;

    // Network errors
    if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
      stats.networkErrors++;

      if (stats.networkErrors <= maxNetworkRetries) {
        const delay = getBackoffDelay(stats.networkErrors);
        console.log(`[Recovery] Network retry ${stats.networkErrors}/${maxNetworkRetries} in ${delay}ms`);

        setTimeout(() => {
          hls.startLoad();
          isRecoveringRef.current = false;
        }, delay);

        return true;
      } else {
        console.log('[Recovery] Max network retries reached');
        isRecoveringRef.current = false;
        
        // Tenta fallback se disponível
        if (onFallback) {
          onFallback();
          return true;
        }
        
        onFatalError?.({ type: data.type, details: data.details });
        return false;
      }
    }

    // Media errors
    if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {
      stats.mediaErrors++;

      if (stats.mediaErrors <= maxMediaRetries) {
        console.log(`[Recovery] Media error recovery ${stats.mediaErrors}/${maxMediaRetries}`);

        if (stats.mediaErrors === 1) {
          // Primeira tentativa: recoverMediaError
          hls.recoverMediaError();
        } else {
          // Tentativas subsequentes: swap audio codec
          hls.swapAudioCodec();
          hls.recoverMediaError();
        }

        setTimeout(() => {
          isRecoveringRef.current = false;
        }, 1000);

        return true;
      } else {
        console.log('[Recovery] Max media retries reached');
        isRecoveringRef.current = false;
        onFatalError?.({ type: data.type, details: data.details });
        return false;
      }
    }

    // Outros erros fatais
    stats.otherErrors++;
    console.log('[Recovery] Unrecoverable error');
    isRecoveringRef.current = false;
    onFatalError?.({ type: data.type, details: data.details });
    return false;
  }, [maxNetworkRetries, maxMediaRetries, getBackoffDelay, onFatalError, onFallback]);

  /**
   * Handle video element error
   */
  const handleVideoError = useCallback((
    video: HTMLVideoElement,
    reinitCallback: () => void
  ): boolean => {
    const stats = statsRef.current;
    const error = video.error;

    if (!error) return false;

    console.log('[Recovery] Video error:', error.code, error.message);

    // MEDIA_ERR_NETWORK ou MEDIA_ERR_SRC_NOT_SUPPORTED
    if (error.code === 2 || error.code === 4) {
      stats.networkErrors++;

      if (stats.networkErrors <= maxNetworkRetries) {
        const delay = getBackoffDelay(stats.networkErrors);
        console.log(`[Recovery] Video retry ${stats.networkErrors}/${maxNetworkRetries} in ${delay}ms`);

        setTimeout(() => {
          reinitCallback();
        }, delay);

        return true;
      }
    }

    onFatalError?.({ type: 'video_error', details: error.message || String(error.code) });
    return false;
  }, [maxNetworkRetries, getBackoffDelay, onFatalError]);

  return {
    handleHlsError,
    handleVideoError,
    resetStats,
    stats: statsRef.current,
    isRecovering: isRecoveringRef.current,
  };
}

export default usePlayerErrorRecovery;
