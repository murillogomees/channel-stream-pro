/**
 * useGlobalOrientationLock - Global portrait lock for the entire app
 * 
 * Locks the app to portrait orientation on mount.
 * Only the player fullscreen button can unlock to landscape.
 */

import { useEffect } from 'react';
import { Capacitor } from '@capacitor/core';

// Try to use Capacitor Screen Orientation if available
let ScreenOrientation: any = null;
try {
  ScreenOrientation = require('@capacitor/screen-orientation').ScreenOrientation;
} catch {
  // Not available
}

export function useGlobalOrientationLock() {
  useEffect(() => {
    const lockPortrait = async () => {
      try {
        // Native Capacitor
        if (Capacitor.isNativePlatform() && ScreenOrientation) {
          await ScreenOrientation.lock({ orientation: 'portrait' });
          console.log('[Orientation] Locked to portrait (native)');
          return;
        }

        // Web API
        if (screen.orientation && 'lock' in screen.orientation) {
          await (screen.orientation as any).lock('portrait-primary');
          console.log('[Orientation] Locked to portrait (web)');
        }
      } catch (e) {
        // Silently fail - not all browsers support this
        console.log('[Orientation] Could not lock (not supported)');
      }
    };

    lockPortrait();

    // No cleanup - keep locked always
  }, []);
}

// Function to temporarily unlock for fullscreen player
export async function unlockForFullscreen(): Promise<void> {
  try {
    if (Capacitor.isNativePlatform() && ScreenOrientation) {
      await ScreenOrientation.lock({ orientation: 'landscape' });
      return;
    }

    if (screen.orientation && 'lock' in screen.orientation) {
      await (screen.orientation as any).lock('landscape-primary');
    }
  } catch (e) {
    console.warn('[Orientation] Could not lock to landscape:', e);
  }
}

// Function to return to portrait after exiting fullscreen
export async function lockToPortrait(): Promise<void> {
  try {
    if (Capacitor.isNativePlatform() && ScreenOrientation) {
      await ScreenOrientation.lock({ orientation: 'portrait' });
      return;
    }

    if (screen.orientation && 'lock' in screen.orientation) {
      await (screen.orientation as any).lock('portrait-primary');
    }
  } catch (e) {
    console.warn('[Orientation] Could not lock to portrait:', e);
  }
}

export default useGlobalOrientationLock;
