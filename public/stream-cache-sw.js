/**
 * Stream Cache Service Worker
 * Cache inteligente para HLS manifests e segments
 */

const CACHE_NAME = 'stream-cache-v2';
const MANIFEST_CACHE_TTL = 10000; // 10 segundos para manifests
const SEGMENT_CACHE_TTL = 3600000; // 1 hora para segments

// Padrões de URL para cache
const MANIFEST_PATTERNS = [
  /\.m3u8(\?|$)/i,
  /\.m3u(\?|$)/i,
  /master\.m3u/i,
  /playlist\.m3u/i,
];

const SEGMENT_PATTERNS = [
  /\.ts(\?|$)/i,
  /\.m4s(\?|$)/i,
  /\.mp4(\?|$)/i,
  /seg-\d+/i,
  /segment/i,
];

// Verifica se é manifesto
function isManifest(url) {
  return MANIFEST_PATTERNS.some(pattern => pattern.test(url));
}

// Verifica se é segment
function isSegment(url) {
  return SEGMENT_PATTERNS.some(pattern => pattern.test(url));
}

// Verifica se resposta está expirada
function isExpired(response, ttl) {
  const dateHeader = response.headers.get('sw-cached-at');
  if (!dateHeader) return true;
  
  const cachedAt = parseInt(dateHeader, 10);
  return Date.now() - cachedAt > ttl;
}

// Install event
self.addEventListener('install', (event) => {
  console.log('[StreamCacheSW] Installing...');
  self.skipWaiting();
});

// Activate event
self.addEventListener('activate', (event) => {
  console.log('[StreamCacheSW] Activating...');
  
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch event - intercepta requests de stream
self.addEventListener('fetch', (event) => {
  const url = event.request.url;
  
  // Ignora requests que não são de stream
  if (!isManifest(url) && !isSegment(url)) {
    return;
  }
  
  event.respondWith(handleStreamRequest(event.request));
});

// Handler principal de requests de stream
async function handleStreamRequest(request) {
  const url = request.url;
  const isManifestRequest = isManifest(url);
  const ttl = isManifestRequest ? MANIFEST_CACHE_TTL : SEGMENT_CACHE_TTL;
  
  try {
    const cache = await caches.open(CACHE_NAME);
    
    // Tenta buscar do cache primeiro
    const cachedResponse = await cache.match(request);
    
    if (cachedResponse) {
      // Verifica expiração
      if (!isExpired(cachedResponse, ttl)) {
        console.log(`[StreamCacheSW] Cache HIT: ${url.substring(0, 80)}`);
        return cachedResponse;
      }
      
      // Manifest expirado - busca em background e retorna cache
      if (isManifestRequest) {
        // Stale-while-revalidate para manifests
        fetchAndCache(request, cache).catch(() => {});
        return cachedResponse;
      }
    }
    
    // Cache miss ou segment expirado - busca da rede
    return await fetchAndCache(request, cache);
    
  } catch (error) {
    console.error('[StreamCacheSW] Error:', error);
    
    // Fallback: tenta cache mesmo expirado
    const cache = await caches.open(CACHE_NAME);
    const staleResponse = await cache.match(request);
    if (staleResponse) {
      return staleResponse;
    }
    
    // Última tentativa: fetch direto
    return fetch(request);
  }
}

// Busca da rede e armazena no cache
async function fetchAndCache(request, cache) {
  const response = await fetch(request.clone());
  
  if (response.ok) {
    // Clona response para modificar headers
    const headers = new Headers(response.headers);
    headers.set('sw-cached-at', Date.now().toString());
    
    // Cache agressivo para segments
    if (isSegment(request.url)) {
      headers.set('Cache-Control', 'public, max-age=3600, immutable');
    }
    
    const cachedResponse = new Response(response.clone().body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
    
    // Armazena no cache (não bloqueia)
    cache.put(request, cachedResponse).catch(() => {});
    
    console.log(`[StreamCacheSW] Cached: ${request.url.substring(0, 80)}`);
  }
  
  return response;
}

// Mensagens do cliente
self.addEventListener('message', (event) => {
  const { type, payload } = event.data || {};
  
  switch (type) {
    case 'PREFETCH':
      // Prefetch de URL
      prefetchUrl(payload.url).then(() => {
        event.ports[0]?.postMessage({ success: true });
      }).catch((error) => {
        event.ports[0]?.postMessage({ success: false, error: error.message });
      });
      break;
      
    case 'PREFETCH_BATCH':
      // Prefetch de múltiplas URLs
      Promise.all(payload.urls.map(url => prefetchUrl(url)))
        .then(() => {
          event.ports[0]?.postMessage({ success: true });
        });
      break;
      
    case 'CLEAR_CACHE':
      // Limpa cache
      caches.delete(CACHE_NAME).then(() => {
        event.ports[0]?.postMessage({ success: true });
      });
      break;
      
    case 'GET_STATS':
      // Retorna estatísticas
      getStats().then((stats) => {
        event.ports[0]?.postMessage(stats);
      });
      break;
  }
});

// Prefetch de URL
async function prefetchUrl(url) {
  const cache = await caches.open(CACHE_NAME);
  const request = new Request(url);
  
  // Verifica se já está cacheado
  const existing = await cache.match(request);
  if (existing) {
    const ttl = isManifest(url) ? MANIFEST_CACHE_TTL : SEGMENT_CACHE_TTL;
    if (!isExpired(existing, ttl)) {
      return;
    }
  }
  
  await fetchAndCache(request, cache);
}

// Estatísticas do cache
async function getStats() {
  try {
    const cache = await caches.open(CACHE_NAME);
    const keys = await cache.keys();
    
    let manifests = 0;
    let segments = 0;
    let totalSize = 0;
    
    for (const request of keys) {
      if (isManifest(request.url)) {
        manifests++;
      } else {
        segments++;
      }
      
      const response = await cache.match(request);
      if (response) {
        const blob = await response.clone().blob();
        totalSize += blob.size;
      }
    }
    
    return {
      manifests,
      segments,
      totalItems: keys.length,
      totalSize,
      totalSizeMB: (totalSize / 1024 / 1024).toFixed(2),
    };
  } catch (error) {
    return { error: error.message };
  }
}

// Limpeza periódica de cache expirado
async function cleanExpiredCache() {
  try {
    const cache = await caches.open(CACHE_NAME);
    const keys = await cache.keys();
    
    for (const request of keys) {
      const response = await cache.match(request);
      if (response) {
        const ttl = isManifest(request.url) ? MANIFEST_CACHE_TTL : SEGMENT_CACHE_TTL;
        if (isExpired(response, ttl)) {
          await cache.delete(request);
        }
      }
    }
  } catch (error) {
    console.error('[StreamCacheSW] Cleanup error:', error);
  }
}

// Executa limpeza a cada 5 minutos
setInterval(cleanExpiredCache, 5 * 60 * 1000);
