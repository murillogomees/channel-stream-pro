/**
 * React 18 Application Entry Point
 * @version 2.0.0 - IPTV removed
 */
import React from "react";
import ReactDOM from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import App from "./App.tsx";
import "./index.css";
import { preloadCriticalAssets } from "./utils/preloadAssets";

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
      staleTime: 1000 * 60 * 5,
      gcTime: 1000 * 60 * 30,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

// Preload assets críticos antes de renderizar
preloadCriticalAssets();

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
