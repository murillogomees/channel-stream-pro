/**
 * usePlaybackWatchdog - Auto-Recovery Watchdog
 * 
 * Detecta playback travado e recupera automaticamente
 * sem intervenção do usuário
 */

import { useEffect, useRef, useCallback, useState } from 'react';

interface WatchdogStats {
  recoveryAttempts: number;
  lastRecoveryTime: number;
  frozenDetections: number;
  isHealthy: boolean;
}

interface UsePlaybackWatchdogOptions {
  enabled?: boolean;
  checkIntervalMs?: number;
  frozenThresholdMs?: number;
  maxRecoveryAttempts?: number;
  onRecovery?: () => void;
  onFatalError?: () => void;
}

export function usePlaybackWatchdog(options: UsePlaybackWatchdogOptions = {}) {
  const {
    enabled = true,
    checkIntervalMs = 2000,
    frozenThresholdMs = 5000,
    maxRecoveryAttempts = 5,
    onRecovery,
    onFatalError,
  } = options;

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const hlsRef = useRef<any>(null);
  const lastTimeRef = useRef<number>(0);
  const lastCheckRef = useRef<number>(Date.now());
  const frozenSinceRef = useRef<number | null>(null);
  const recoveryAttemptsRef = useRef<number>(0);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const [stats, setStats] = useState<WatchdogStats>({
    recoveryAttempts: 0,
    lastRecoveryTime: 0,
    frozenDetections: 0,
    isHealthy: true,
  });

  /**
   * Attempt recovery from frozen state
   */
  const attemptRecovery = useCallback(() => {
    const video = videoRef.current;
    const hls = hlsRef.current;
    
    if (!video) return false;

    recoveryAttemptsRef.current++;
    setStats(prev => ({
      ...prev,
      recoveryAttempts: recoveryAttemptsRef.current,
      lastRecoveryTime: Date.now(),
    }));

    console.log(`[Watchdog] Recovery attempt ${recoveryAttemptsRef.current}/${maxRecoveryAttempts}`);

    // Strategy 1: Simple seek nudge
    if (recoveryAttemptsRef.current === 1) {
      const currentTime = video.currentTime;
      video.currentTime = currentTime + 0.1;
      console.log('[Watchdog] Strategy 1: Seek nudge');
      return true;
    }

    // Strategy 2: Pause and play
    if (recoveryAttemptsRef.current === 2) {
      video.pause();
      setTimeout(() => video.play().catch(console.warn), 100);
      console.log('[Watchdog] Strategy 2: Pause/play');
      return true;
    }

    // Strategy 3: HLS recovery (if available)
    if (recoveryAttemptsRef.current === 3 && hls) {
      try {
        hls.recoverMediaError();
        console.log('[Watchdog] Strategy 3: HLS recoverMediaError');
        return true;
      } catch (e) {
        console.warn('[Watchdog] HLS recovery failed:', e);
      }
    }

    // Strategy 4: Reload source
    if (recoveryAttemptsRef.current === 4 && hls) {
      try {
        const currentLevel = hls.currentLevel;
        hls.startLoad();
        hls.currentLevel = currentLevel;
        console.log('[Watchdog] Strategy 4: Reload source');
        return true;
      } catch (e) {
        console.warn('[Watchdog] Source reload failed:', e);
      }
    }

    // Strategy 5: Full reload
    if (recoveryAttemptsRef.current >= 5) {
      console.log('[Watchdog] Strategy 5: Full reload');
      video.load();
      video.play().catch(console.warn);
      return true;
    }

    return false;
  }, [maxRecoveryAttempts]);

  /**
   * Check playback health
   */
  const checkHealth = useCallback(() => {
    const video = videoRef.current;
    if (!video || video.paused || video.ended) {
      frozenSinceRef.current = null;
      return;
    }

    const now = Date.now();
    const currentTime = video.currentTime;
    const timeSinceLastCheck = now - lastCheckRef.current;

    // Check if time hasn't progressed
    if (Math.abs(currentTime - lastTimeRef.current) < 0.1 && timeSinceLastCheck > 500) {
      // Playback might be frozen
      if (!frozenSinceRef.current) {
        frozenSinceRef.current = now;
        console.log('[Watchdog] Potential freeze detected');
      } else if (now - frozenSinceRef.current > frozenThresholdMs) {
        // Confirmed frozen
        setStats(prev => ({
          ...prev,
          frozenDetections: prev.frozenDetections + 1,
          isHealthy: false,
        }));

        console.log(`[Watchdog] Frozen for ${now - frozenSinceRef.current}ms`);

        if (recoveryAttemptsRef.current >= maxRecoveryAttempts) {
          console.log('[Watchdog] Max recovery attempts reached');
          onFatalError?.();
          return;
        }

        const recovered = attemptRecovery();
        if (recovered) {
          onRecovery?.();
          frozenSinceRef.current = null;
        }
      }
    } else {
      // Playback is progressing
      if (frozenSinceRef.current) {
        console.log('[Watchdog] Playback resumed');
        frozenSinceRef.current = null;
        
        // Reset recovery attempts after successful playback
        setTimeout(() => {
          if (!frozenSinceRef.current) {
            recoveryAttemptsRef.current = Math.max(0, recoveryAttemptsRef.current - 1);
          }
        }, 10000);
      }
      
      setStats(prev => ({ ...prev, isHealthy: true }));
    }

    lastTimeRef.current = currentTime;
    lastCheckRef.current = now;
  }, [frozenThresholdMs, maxRecoveryAttempts, attemptRecovery, onRecovery, onFatalError]);

  /**
   * Attach video element
   */
  const attachVideo = useCallback((video: HTMLVideoElement) => {
    videoRef.current = video;
    lastTimeRef.current = video.currentTime;
    lastCheckRef.current = Date.now();
    frozenSinceRef.current = null;
    recoveryAttemptsRef.current = 0;
  }, []);

  /**
   * Attach HLS instance
   */
  const attachHls = useCallback((hls: any) => {
    hlsRef.current = hls;
  }, []);

  /**
   * Reset watchdog state
   */
  const reset = useCallback(() => {
    frozenSinceRef.current = null;
    recoveryAttemptsRef.current = 0;
    setStats({
      recoveryAttempts: 0,
      lastRecoveryTime: 0,
      frozenDetections: 0,
      isHealthy: true,
    });
  }, []);

  // Start watchdog interval
  useEffect(() => {
    if (!enabled) return;

    intervalRef.current = setInterval(checkHealth, checkIntervalMs);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [enabled, checkIntervalMs, checkHealth]);

  return {
    attachVideo,
    attachHls,
    reset,
    stats,
    isHealthy: stats.isHealthy,
  };
}

export default usePlaybackWatchdog;
