/**
 * ============================================================================
 * usePlayerCleanup - Memory Management Hook for HLS Player
 * ============================================================================
 * 
 * Ensures proper cleanup of HLS instances, event listeners, and resources
 * to prevent memory leaks during channel switching.
 */

import { useRef, useCallback, useEffect } from 'react';
import Hls from 'hls.js';

// WeakMap for event listener cache - prevents memory leaks
const listenerCache = new WeakMap<HTMLVideoElement, Map<string, EventListener>>();

interface CleanupStats {
  hlsInstancesDestroyed: number;
  listenersRemoved: number;
  lastCleanup: number;
}

interface UsePlayerCleanupReturn {
  registerHls: (hls: Hls) => void;
  registerVideoElement: (video: HTMLVideoElement) => void;
  addEventListener: (video: HTMLVideoElement, event: string, handler: EventListener) => void;
  cleanup: () => void;
  forceGC: () => void;
  stats: CleanupStats;
}

export function usePlayerCleanup(): UsePlayerCleanupReturn {
  const hlsRef = useRef<Hls | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const statsRef = useRef<CleanupStats>({
    hlsInstancesDestroyed: 0,
    listenersRemoved: 0,
    lastCleanup: 0,
  });

  /**
   * Register HLS instance for cleanup tracking
   */
  const registerHls = useCallback((hls: Hls) => {
    // Cleanup previous instance first
    if (hlsRef.current && hlsRef.current !== hls) {
      hlsRef.current.destroy();
      statsRef.current.hlsInstancesDestroyed++;
    }
    hlsRef.current = hls;
  }, []);

  /**
   * Register video element for event listener tracking
   */
  const registerVideoElement = useCallback((video: HTMLVideoElement) => {
    // Initialize listener map for this video element
    if (!listenerCache.has(video)) {
      listenerCache.set(video, new Map());
    }
    videoRef.current = video;
  }, []);

  /**
   * Add event listener with automatic tracking
   */
  const addEventListener = useCallback((
    video: HTMLVideoElement,
    event: string,
    handler: EventListener
  ) => {
    let listeners = listenerCache.get(video);
    if (!listeners) {
      listeners = new Map();
      listenerCache.set(video, listeners);
    }

    // Remove existing listener for this event
    const existingHandler = listeners.get(event);
    if (existingHandler) {
      video.removeEventListener(event, existingHandler);
      statsRef.current.listenersRemoved++;
    }

    // Add new listener and track it
    video.addEventListener(event, handler);
    listeners.set(event, handler);
  }, []);

  /**
   * Cleanup all resources
   */
  const cleanup = useCallback(() => {
    // Destroy HLS instance
    if (hlsRef.current) {
      try {
        hlsRef.current.stopLoad();
        hlsRef.current.detachMedia();
        hlsRef.current.destroy();
        statsRef.current.hlsInstancesDestroyed++;
      } catch (e) {
        console.warn('[PlayerCleanup] Error destroying HLS:', e);
      }
      hlsRef.current = null;
    }

    // Remove all event listeners from video element
    if (videoRef.current) {
      const listeners = listenerCache.get(videoRef.current);
      if (listeners) {
        listeners.forEach((handler, event) => {
          videoRef.current?.removeEventListener(event, handler);
          statsRef.current.listenersRemoved++;
        });
        listeners.clear();
      }

      // Clear video src and load to release resources
      try {
        videoRef.current.pause();
        videoRef.current.removeAttribute('src');
        videoRef.current.load();
      } catch (e) {
        console.warn('[PlayerCleanup] Error clearing video:', e);
      }
      videoRef.current = null;
    }

    statsRef.current.lastCleanup = Date.now();
    console.log('[PlayerCleanup] Cleanup complete:', statsRef.current);
  }, []);

  /**
   * Force garbage collection hint (browser may ignore)
   */
  const forceGC = useCallback(() => {
    // Clear any detached DOM nodes
    if (typeof window !== 'undefined') {
      // Hint to browser to run GC
      const tmpArray = [];
      for (let i = 0; i < 100; i++) {
        tmpArray.push(new ArrayBuffer(1024 * 1024)); // 1MB
      }
      // Let tmpArray go out of scope
    }
    console.log('[PlayerCleanup] GC hint sent');
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanup();
    };
  }, [cleanup]);

  return {
    registerHls,
    registerVideoElement,
    addEventListener,
    cleanup,
    forceGC,
    stats: statsRef.current,
  };
}

/**
 * Utility function to clean up detached HLS instances
 * Call this periodically or after heavy usage
 */
export function cleanupDetachedPlayers(): void {
  // This is a hint to the browser - actual implementation depends on browser
  if ('gc' in window) {
    (window as any).gc();
  }
  console.log('[PlayerCleanup] Detached players cleanup requested');
}

export default usePlayerCleanup;
