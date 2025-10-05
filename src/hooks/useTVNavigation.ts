import { useEffect, useRef, useState } from 'react';

export interface FocusableElement {
  id: string;
  element: HTMLElement;
  x: number;
  y: number;
  width: number;
  height: number;
}

export function useTVNavigation(enabled: boolean = false) {
  const [focusedId, setFocusedId] = useState<string | null>(null);
  const elementsRef = useRef<Map<string, HTMLElement>>(new Map());

  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const focused = document.activeElement as HTMLElement;
      
      switch (e.key) {
        case 'ArrowUp':
        case 'ArrowDown':
        case 'ArrowLeft':
        case 'ArrowRight':
          e.preventDefault();
          navigateDirection(e.key, focused);
          break;
        case 'Enter':
          e.preventDefault();
          focused?.click();
          break;
        case 'Escape':
        case 'Back':
          e.preventDefault();
          window.history.back();
          break;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [enabled]);

  const navigateDirection = (direction: string, current: HTMLElement) => {
    const focusables = Array.from(
      document.querySelectorAll('[data-focusable="true"]')
    ) as HTMLElement[];

    if (focusables.length === 0) return;

    const currentIndex = focusables.indexOf(current);
    let nextIndex = currentIndex;

    const rect = current?.getBoundingClientRect();
    const candidates = focusables
      .map((el, idx) => {
        const r = el.getBoundingClientRect();
        return { el, idx, rect: r };
      })
      .filter(({ idx }) => idx !== currentIndex);

    let best: typeof candidates[0] | null = null;

    candidates.forEach(candidate => {
      const r = candidate.rect;
      
      switch (direction) {
        case 'ArrowUp':
          if (r.top < rect.top && Math.abs(r.left - rect.left) < rect.width) {
            if (!best || r.top > best.rect.top) best = candidate;
          }
          break;
        case 'ArrowDown':
          if (r.top > rect.top && Math.abs(r.left - rect.left) < rect.width) {
            if (!best || r.top < best.rect.top) best = candidate;
          }
          break;
        case 'ArrowLeft':
          if (r.left < rect.left && Math.abs(r.top - rect.top) < rect.height) {
            if (!best || r.left > best.rect.left) best = candidate;
          }
          break;
        case 'ArrowRight':
          if (r.left > rect.left && Math.abs(r.top - rect.top) < rect.height) {
            if (!best || r.left < best.rect.left) best = candidate;
          }
          break;
      }
    });

    if (best) {
      best.el.focus();
      setFocusedId(best.el.getAttribute('data-focus-id'));
    }
  };

  const registerElement = (id: string, element: HTMLElement | null) => {
    if (element) {
      elementsRef.current.set(id, element);
    } else {
      elementsRef.current.delete(id);
    }
  };

  return {
    focusedId,
    setFocusedId,
    registerElement,
  };
}
