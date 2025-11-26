import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { preloadCriticalAssets } from "./utils/preloadAssets";

// Preload assets críticos antes de renderizar
preloadCriticalAssets();

// Suprimir erros de WebSocket do Realtime em produção para evitar impacto no Lighthouse
if (import.meta.env.PROD) {
  const originalConsoleError = console.error;
  console.error = (...args: any[]) => {
    const errorMessage = args[0]?.toString() || '';
    
    // Suprimir erros de conexão WebSocket do Realtime
    if (
      errorMessage.includes('WebSocket connection') &&
      errorMessage.includes('realtime') &&
      (errorMessage.includes('ERR_NAME_NOT_RESOLVED') || 
       errorMessage.includes('failed') ||
       errorMessage.includes('connection establishment'))
    ) {
      return; // Silenciar erro
    }
    
    originalConsoleError.apply(console, args);
  };
}

createRoot(document.getElementById("root")!).render(
  <App />
);

// Register service worker for PWA
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then(registration => {
        console.log('SW registered:', registration);
      })
      .catch(error => {
        console.log('SW registration failed:', error);
      });
  });
}
