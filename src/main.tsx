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
import { webVitalsService } from "./services/webVitalsService";

// Force clear ALL caches and UNREGISTER all service workers
if ('caches' in window) {
  caches.keys().then(names => {
    names.forEach(name => caches.delete(name));
  });
}

// Force unregister ALL service workers
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then(registrations => {
    registrations.forEach(registration => {
      registration.unregister();
      console.log('[SW] Unregistered:', registration.scope);
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

// Initialize Web Vitals monitoring
webVitalsService.init((report) => {
  console.log('[WebVitals] Report:', report.score, 'score');
});

// Suprimir ruídos de console para melhor experiência de desenvolvimento
const originalConsoleError = console.error;
const originalConsoleWarn = console.warn;

console.error = (...args: unknown[]) => {
  const errorMessage = String(args[0] || '');
  
  // Suprimir erros conhecidos que não afetam funcionalidade
  const suppressPatterns = [
    // WebSocket do Realtime (esperado em desenvolvimento)
    /WebSocket.*realtime/i,
    /websocket.*failed/i,
    /wss:\/\/.*failed/i,
    // Erros de rede esperados (offline, DNS)
    /ERR_NAME_NOT_RESOLVED/,
    /ERR_NETWORK/,
    /ERR_CONNECTION/,
    // Service Worker tentando cachear URLs inválidas
    /chrome-extension/i,
    /Failed to execute 'put' on 'Cache'/,
    /Failed to convert value to 'Response'/,
    // Facebook Pixel (funciona mesmo com alguns 400s de pré-fetch)
    /facebook\.com.*400/i,
  ];
  
  if (suppressPatterns.some(pattern => pattern.test(errorMessage))) {
    return;
  }
  
  originalConsoleError.apply(console, args);
};

console.warn = (...args: unknown[]) => {
  const warnMessage = String(args[0] || '');
  
  // Suprimir avisos conhecidos
  if (
    /WebSocket.*realtime/i.test(warnMessage) ||
    /websocket.*failed/i.test(warnMessage) ||
    /chrome-extension/i.test(warnMessage)
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
