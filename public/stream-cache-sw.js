/**
 * Stream Cache Service Worker - DESABILITADO
 * 
 * Este Service Worker foi desabilitado para simplificar o player.
 * Todos os requests passam direto para a rede sem interceptação.
 */

const CACHE_NAME = 'stream-cache-v3';

// Install event
self.addEventListener('install', () => {
  console.log('[StreamCacheSW] Instalado (modo passivo)');
  self.skipWaiting();
});

// Activate event - limpa caches antigos
self.addEventListener('activate', (event) => {
  console.log('[StreamCacheSW] Ativado (modo passivo)');
  
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((name) => caches.delete(name))
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch event - NÃO intercepta NADA, deixa ir direto para a rede
self.addEventListener('fetch', () => {
  // Não faz nada - deixa request ir direto para a rede
  return;
});

// Mensagens do cliente
self.addEventListener('message', (event) => {
  const { type } = event.data || {};
  
  switch (type) {
    case 'GET_STATS':
      event.ports[0]?.postMessage({ 
        status: 'disabled',
        manifests: 0, 
        segments: 0, 
        totalItems: 0, 
        totalSize: 0 
      });
      break;
      
    case 'CLEAR_CACHE':
      caches.delete(CACHE_NAME).then(() => {
        event.ports[0]?.postMessage({ success: true });
      });
      break;
  }
});
