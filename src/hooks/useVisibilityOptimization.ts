/**
 * useVisibilityOptimization - Pausa/reduz qualidade quando tab não está visível
 */

import { useEffect, useRef, useCallback } from 'react';
import Hls from 'hls.js';

interface UseVisibilityOptimizationOptions {
  /** Pausar quando invisível (default: false para live) */
  pauseWhenHidden?: boolean;
  /** Reduzir qualidade quando invisível */
  reduceQualityWhenHidden?: boolean;
  /** Parar carregamento quando invisível (economiza bandwidth) */
  stopLoadWhenHidden?: boolean;
}

export function useVisibilityOptimization(
  videoRef: React.RefObject<HTMLVideoElement>,
  hlsRef: React.RefObject<Hls | null>,
  options: UseVisibilityOptimizationOptions = {}
) {
  const {
    pauseWhenHidden = false,
    reduceQualityWhenHidden = true,
    stopLoadWhenHidden = false,
  } = options;

  const previousLevelRef = useRef<number>(-1);
  const wasPlayingRef = useRef<boolean>(false);

  const handleVisibilityChange = useCallback(() => {
    const video = videoRef.current;
    const hls = hlsRef.current;
    const isHidden = document.hidden;

    console.log('[Visibility] Tab visibility changed:', isHidden ? 'hidden' : 'visible');

    if (isHidden) {
      // Tab ficou invisível
      wasPlayingRef.current = video ? !video.paused : false;

      if (pauseWhenHidden && video) {
        video.pause();
      }

      if (hls) {
        if (stopLoadWhenHidden) {
          hls.stopLoad();
          console.log('[Visibility] Stopped HLS loading');
        }

        if (reduceQualityWhenHidden && hls.currentLevel !== -1) {
          previousLevelRef.current = hls.currentLevel;
          // Força o nível mais baixo
          hls.currentLevel = 0;
          hls.nextLevel = 0;
          console.log('[Visibility] Reduced quality to lowest level');
        }
      }
    } else {
      // Tab voltou a ficar visível
      if (hls) {
        if (stopLoadWhenHidden) {
          hls.startLoad();
          console.log('[Visibility] Resumed HLS loading');
        }

        if (reduceQualityWhenHidden && previousLevelRef.current !== -1) {
          // Volta para auto ou nível anterior
          hls.currentLevel = -1; // Auto
          hls.nextLevel = -1;
          console.log('[Visibility] Restored auto quality');
          previousLevelRef.current = -1;
        }
      }

      if (pauseWhenHidden && wasPlayingRef.current && video) {
        video.play().catch(() => {});
      }
    }
  }, [videoRef, hlsRef, pauseWhenHidden, reduceQualityWhenHidden, stopLoadWhenHidden]);

  useEffect(() => {
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [handleVisibilityChange]);

  return {
    isHidden: document.hidden,
  };
}

export default useVisibilityOptimization;
