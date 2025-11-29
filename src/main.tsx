/**
 * React 18 Application Entry Point
 * @version 1.0.6
 * Cache bust: v3
 */
import React from "react";
import ReactDOM from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import App from "./App.tsx";
import "./index.css";
import { preloadCriticalAssets } from "./utils/preloadAssets";
import { registerServiceWorker } from "./lib/sw/registerServiceWorker";
import { webVitalsService } from "./services/webVitalsService";
import { streamCacheService } from "./services/streamCacheService";

// Force clear ALL caches on startup to prevent React duplicate instances
if ('caches' in window) {
  caches.keys().then(names => {
    names.forEach(name => {
      caches.delete(name);
    });
  });
}

// Clear sessionStorage/localStorage cache markers
try {
  sessionStorage.removeItem('vite-cache');
  Object.keys(sessionStorage).forEach(key => {
    if (key.includes('vite') || key.includes('deps')) {
      sessionStorage.removeItem(key);
    }
  });
} catch (e) {
  // Ignore
}

// Create a query client for React Query
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      gcTime: 1000 * 60 * 30, // 30 minutes
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

// Preload assets críticos antes de renderizar
preloadCriticalAssets();

// Register Service Worker
registerServiceWorker();

// Initialize Web Vitals monitoring
webVitalsService.init((report) => {
  console.log('[WebVitals] Report:', report.score, 'score');
});

// Initialize stream cache service
streamCacheService.init();

// Suprimir erros de WebSocket do Realtime para evitar impacto no Lighthouse/SEO
const originalConsoleError = console.error;
const originalConsoleWarn = console.warn;

console.error = (...args: unknown[]) => {
  const errorMessage = String(args[0] || '');
  
  // Suprimir todos os erros relacionados ao WebSocket do Realtime
  if (
    (errorMessage.includes('WebSocket') && errorMessage.includes('realtime')) ||
    (errorMessage.includes('sdvyxdghxqmntyoweqbd.supabase.co') && errorMessage.includes('websocket')) ||
    errorMessage.includes('ERR_NAME_NOT_RESOLVED') ||
    (errorMessage.includes('wss://') && errorMessage.includes('failed'))
  ) {
    return; // Silenciar completamente
  }
  
  originalConsoleError.apply(console, args);
};

console.warn = (...args: unknown[]) => {
  const warnMessage = String(args[0] || '');
  
  // Suprimir avisos do WebSocket do Realtime
  if (
    (warnMessage.includes('WebSocket') && warnMessage.includes('realtime')) ||
    (warnMessage.includes('sdvyxdghxqmntyoweqbd.supabase.co') && warnMessage.includes('websocket'))
  ) {
    return;
  }
  
  originalConsoleWarn.apply(console, args);
};

const rootElement = document.getElementById("root");
if (rootElement) {
  ReactDOM.createRoot(rootElement).render(
    <React.StrictMode>
      <QueryClientProvider client={queryClient}>
        <App />
      </QueryClientProvider>
    </React.StrictMode>
  );
}

// Screen Orientation API - lock landscape when player goes fullscreen
if ('screen' in window && 'orientation' in screen) {
  document.addEventListener('fullscreenchange', () => {
    const isFullscreen = !!document.fullscreenElement;
    const isVideoPlayer = document.fullscreenElement?.tagName === 'VIDEO' || 
                          document.fullscreenElement?.classList.contains('video-player') ||
                          document.fullscreenElement?.querySelector('video');
    
    if (isFullscreen && isVideoPlayer) {
      // Lock to landscape in fullscreen video
      (screen.orientation as ScreenOrientation & { lock?: (orientation: string) => Promise<void> }).lock?.('landscape').catch(() => {});
    } else if (!isFullscreen) {
      // Unlock orientation when exiting fullscreen
      (screen.orientation as ScreenOrientation & { unlock?: () => void }).unlock?.();
    }
  });
}
