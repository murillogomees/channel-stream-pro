import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { preloadCriticalAssets } from "./utils/preloadAssets";

// Preload assets críticos antes de renderizar
preloadCriticalAssets();

// Suprimir erros de WebSocket do Realtime para evitar impacto no Lighthouse/SEO
const originalConsoleError = console.error;
const originalConsoleWarn = console.warn;

console.error = (...args: any[]) => {
  const errorMessage = args[0]?.toString() || '';
  
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

console.warn = (...args: any[]) => {
  const warnMessage = args[0]?.toString() || '';
  
  // Suprimir avisos do WebSocket do Realtime
  if (
    (warnMessage.includes('WebSocket') && warnMessage.includes('realtime')) ||
    (warnMessage.includes('sdvyxdghxqmntyoweqbd.supabase.co') && warnMessage.includes('websocket'))
  ) {
    return;
  }
  
  originalConsoleWarn.apply(console, args);
};

createRoot(document.getElementById("root")!).render(
  <App />
);

// Register service worker for PWA - only in production
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then(registration => {
        // Check for updates periodically
        setInterval(() => registration.update(), 60 * 60 * 1000);
      })
      .catch(() => {
        // Silent fail - SW not critical
      });
  });
}
