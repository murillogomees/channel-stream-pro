/**
 * Smart TV Hook
 * Provides TV-optimized configurations and behaviors
 */

import { useState, useEffect, useCallback } from 'react';
import { smartTvDetection, type SmartTvInfo, type SmartTvPlatform } from '../services/smartTvDetection';

interface UseSmartTvResult {
  info: SmartTvInfo;
  isSmartTv: boolean;
  isTv: boolean;
  platform: SmartTvPlatform;
  uiScale: number;
  showFocusIndicators: boolean;
  hlsConfig: Record<string, any>;
  focusedElement: string | null;
  setFocus: (elementId: string) => void;
  moveFocus: (direction: 'up' | 'down' | 'left' | 'right') => void;
}

// Define focusable elements grid for D-pad navigation
interface FocusableElement {
  id: string;
  up?: string;
  down?: string;
  left?: string;
  right?: string;
}

const defaultFocusMap: FocusableElement[] = [
  { id: 'play-pause', up: 'info', down: 'volume', left: 'channel-down', right: 'volume' },
  { id: 'volume', up: 'play-pause', down: 'settings', left: 'play-pause', right: 'settings' },
  { id: 'settings', up: 'volume', down: 'fullscreen', left: 'volume', right: 'fullscreen' },
  { id: 'fullscreen', up: 'settings', down: 'play-pause', left: 'settings', right: 'channel-up' },
  { id: 'channel-up', down: 'channel-down', left: 'fullscreen', right: 'play-pause' },
  { id: 'channel-down', up: 'channel-up', left: 'fullscreen', right: 'play-pause' },
  { id: 'info', down: 'play-pause', left: 'channel-up', right: 'settings' },
];

export function useSmartTv(customFocusMap?: FocusableElement[]): UseSmartTvResult {
  const [info] = useState(() => smartTvDetection.detect());
  const [focusedElement, setFocusedElement] = useState<string | null>(
    info.isTv ? 'play-pause' : null
  );
  
  const focusMap = customFocusMap || defaultFocusMap;

  // Set focus to element
  const setFocus = useCallback((elementId: string) => {
    setFocusedElement(elementId);
    
    // Focus actual DOM element
    const element = document.querySelector(`[data-focus-id="${elementId}"]`);
    if (element instanceof HTMLElement) {
      element.focus();
    }
  }, []);

  // D-pad navigation
  const moveFocus = useCallback((direction: 'up' | 'down' | 'left' | 'right') => {
    if (!focusedElement) {
      setFocus('play-pause');
      return;
    }

    const current = focusMap.find(el => el.id === focusedElement);
    if (!current) return;

    const nextId = current[direction];
    if (nextId) {
      setFocus(nextId);
    }
  }, [focusedElement, focusMap, setFocus]);

  // Handle keyboard/remote navigation
  useEffect(() => {
    if (!info.isTv) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowUp':
          e.preventDefault();
          moveFocus('up');
          break;
        case 'ArrowDown':
          e.preventDefault();
          moveFocus('down');
          break;
        case 'ArrowLeft':
          e.preventDefault();
          moveFocus('left');
          break;
        case 'ArrowRight':
          e.preventDefault();
          moveFocus('right');
          break;
        case 'Enter':
        case ' ':
          // Click the focused element
          if (focusedElement) {
            const element = document.querySelector(`[data-focus-id="${focusedElement}"]`);
            if (element instanceof HTMLElement) {
              e.preventDefault();
              element.click();
            }
          }
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [info.isTv, focusedElement, moveFocus]);

  // Apply TV-specific CSS
  useEffect(() => {
    if (info.isTv) {
      document.documentElement.classList.add('tv-mode');
      document.documentElement.style.setProperty('--tv-scale', String(smartTvDetection.getUiScale()));
    }
    
    return () => {
      document.documentElement.classList.remove('tv-mode');
      document.documentElement.style.removeProperty('--tv-scale');
    };
  }, [info.isTv]);

  return {
    info,
    isSmartTv: info.isSmartTv,
    isTv: info.isTv,
    platform: info.platform,
    uiScale: smartTvDetection.getUiScale(),
    showFocusIndicators: smartTvDetection.shouldShowFocusIndicators(),
    hlsConfig: smartTvDetection.getHlsConfig(),
    focusedElement,
    setFocus,
    moveFocus,
  };
}
