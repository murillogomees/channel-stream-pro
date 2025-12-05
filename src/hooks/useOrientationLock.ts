/**
 * useOrientationLock - Lock screen orientation control
 * 
 * By default: locks to portrait (vertical)
 * When player plays or goes fullscreen: unlocks to landscape (horizontal)
 */

import { useCallback, useEffect, useState } from 'react';
import { Capacitor } from '@capacitor/core';

type OrientationType = 'portrait' | 'landscape' | 'any';

interface UseOrientationLockReturn {
  currentOrientation: OrientationType;
  isLocked: boolean;
  lockToPortrait: () => Promise<void>;
  lockToLandscape: () => Promise<void>;
  unlock: () => Promise<void>;
}

// Try to use Capacitor Screen Orientation if available
let ScreenOrientation: any = null;
try {
  ScreenOrientation = require('@capacitor/screen-orientation').ScreenOrientation;
} catch {
  // Not available
}

export function useOrientationLock(): UseOrientationLockReturn {
  const [currentOrientation, setCurrentOrientation] = useState<OrientationType>('portrait');
  const [isLocked, setIsLocked] = useState(false);

  // Detect current orientation
  const detectOrientation = useCallback(() => {
    const isLandscape = window.innerWidth > window.innerHeight;
    setCurrentOrientation(isLandscape ? 'landscape' : 'portrait');
  }, []);

  // Lock to portrait (vertical)
  const lockToPortrait = useCallback(async () => {
    try {
      // Native Capacitor
      if (Capacitor.isNativePlatform() && ScreenOrientation) {
        await ScreenOrientation.lock({ orientation: 'portrait' });
        setIsLocked(true);
        setCurrentOrientation('portrait');
        return;
      }

      // Web API
      if (screen.orientation && 'lock' in screen.orientation) {
        await (screen.orientation as any).lock('portrait-primary');
        setIsLocked(true);
        setCurrentOrientation('portrait');
      }
    } catch (e) {
      console.warn('[OrientationLock] Could not lock to portrait:', e);
    }
  }, []);

  // Lock to landscape (horizontal) - for player fullscreen
  const lockToLandscape = useCallback(async () => {
    try {
      // Native Capacitor
      if (Capacitor.isNativePlatform() && ScreenOrientation) {
        await ScreenOrientation.lock({ orientation: 'landscape' });
        setIsLocked(true);
        setCurrentOrientation('landscape');
        return;
      }

      // Web API
      if (screen.orientation && 'lock' in screen.orientation) {
        await (screen.orientation as any).lock('landscape-primary');
        setIsLocked(true);
        setCurrentOrientation('landscape');
      }
    } catch (e) {
      console.warn('[OrientationLock] Could not lock to landscape:', e);
    }
  }, []);

  // Unlock orientation
  const unlock = useCallback(async () => {
    try {
      // Native Capacitor
      if (Capacitor.isNativePlatform() && ScreenOrientation) {
        await ScreenOrientation.unlock();
        setIsLocked(false);
        detectOrientation();
        return;
      }

      // Web API
      if (screen.orientation && 'unlock' in screen.orientation) {
        screen.orientation.unlock();
        setIsLocked(false);
        detectOrientation();
      }
    } catch (e) {
      console.warn('[OrientationLock] Could not unlock:', e);
    }
  }, [detectOrientation]);

  // Listen for orientation changes
  useEffect(() => {
    detectOrientation();
    
    window.addEventListener('resize', detectOrientation);
    window.addEventListener('orientationchange', detectOrientation);

    return () => {
      window.removeEventListener('resize', detectOrientation);
      window.removeEventListener('orientationchange', detectOrientation);
    };
  }, [detectOrientation]);

  return {
    currentOrientation,
    isLocked,
    lockToPortrait,
    lockToLandscape,
    unlock,
  };
}

export default useOrientationLock;
