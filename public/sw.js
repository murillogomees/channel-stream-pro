// public/sw.js
// Lovable - Service Worker Completo v2.0
// Offline-First + Background Sync + Push Notifications

const SW_VERSION = "lovable-sw-v2.0";

// Cache names
const CACHE_NAMES = {
  STATIC: 'static-cache-v1',
  DYNAMIC: 'dynamic-cache-v1',
  M3U: 'm3u-cache-v1',
  STREAMS: 'streams-cache-v1',
  IMAGES: 'images-cache-v1'
};

// Cache limits
const CACHE_LIMITS = {
  [CACHE_NAMES.DYNAMIC]: 100,
  [CACHE_NAMES.M3U]: 10,
  [CACHE_NAMES.STREAMS]: 50,
  [CACHE_NAMES.IMAGES]: 200
};

// Precache URLs - static assets
const PRECACHE_URLS = [
  '/',
  '/index.html',
  '/offline.html',
  '/favicon.ico',
  '/favicon.png',
  '/logo.webp',
  '/pwa-icon.png',
  '/logo.png'
];

// TTL for different content types (ms)
const TTL = {
  PLAYLIST: 5 * 60 * 1000,    // 5 minutes
  IMAGES: 24 * 60 * 60 * 1000, // 24 hours
  EPG: 30 * 60 * 1000          // 30 minutes
};

// Debug flag - enable via URL param ?debug-sw
const DEBUG = false;
function log(...args) {
  if (DEBUG) console.log('[SW]', ...args);
}

// ============ INSTALL ============
self.addEventListener('install', (event) => {
  log('Installing...');
  self.skipWaiting();

  event.waitUntil(
    caches.open(CACHE_NAMES.STATIC)
      .then(cache => cache.addAll(PRECACHE_URLS))
      .then(() => log('Precache complete'))
      .catch(err => console.error('[SW] Precache failed:', err))
  );
});

// ============ ACTIVATE ============
self.addEventListener('activate', (event) => {
  log('Activating...');

  event.waitUntil(
    (async () => {
      await clients.claim();

      const cacheKeys = await caches.keys();
      const validCaches = Object.values(CACHE_NAMES);
      await Promise.all(
        cacheKeys
          .filter(key => !validCaches.includes(key))
          .map(key => {
            log('Deleting old cache:', key);
            return caches.delete(key);
          })
      );

      const allClients = await clients.matchAll();
      allClients.forEach(client => {
        client.postMessage({ type: 'SW_ACTIVATED', version: SW_VERSION });
      });
    })()
  );
});

// URLs que devem ser IGNORADAS pelo Service Worker
const SKIP_PATTERNS = [
  /chrome-extension:\/\//i,
  /chrome:\/\//i,
  /^blob:/,
  /facebook\.com/i,
  /fbcdn\.net/i,
  /doubleclick\.net/i,
  /google-analytics\.com/i,
  /googletagmanager\.com/i,
];

function shouldSkipRequest(url) {
  return SKIP_PATTERNS.some(pattern => pattern.test(url));
}

// ============ FETCH STRATEGIES ============

async function cacheFirst(request, cacheName = CACHE_NAMES.STATIC) {
  // Verificar se deve ignorar
  if (shouldSkipRequest(request.url)) {
    return fetch(request);
  }

  const cached = await caches.match(request);
  if (cached) {
    log('Cache hit:', request.url);
    return cached;
  }

  try {
    const response = await fetch(request);
    if (response && response.ok) {
      try {
        const cache = await caches.open(cacheName);
        await cache.put(request, response.clone());
      } catch (cacheError) {
        // Ignorar erros de cache silenciosamente
        log('Cache put failed (ignored):', cacheError.message);
      }
    }
    return response;
  } catch (error) {
    log('Fetch failed:', request.url);
    return caches.match('/offline.html');
  }
}

async function networkFirst(request, cacheName = CACHE_NAMES.DYNAMIC) {
  // Verificar se deve ignorar
  if (shouldSkipRequest(request.url)) {
    return fetch(request);
  }

  try {
    const response = await fetch(request);
    if (response && response.ok) {
      try {
        const cache = await caches.open(cacheName);
        await cache.put(request, response.clone());
      } catch (cacheError) {
        log('Cache put failed (ignored):', cacheError.message);
      }
    }
    return response;
  } catch (error) {
    log('Network failed, trying cache:', request.url);
    const cached = await caches.match(request);
    if (cached) return cached;
    return caches.match('/offline.html');
  }
}

async function staleWhileRevalidate(request, cacheName = CACHE_NAMES.DYNAMIC) {
  // Verificar se deve ignorar
  if (shouldSkipRequest(request.url)) {
    return fetch(request);
  }

  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);

  const fetchPromise = fetch(request)
    .then(response => {
      if (response && response.ok) {
        try {
          cache.put(request, response.clone());
        } catch (cacheError) {
          log('Cache put failed (ignored):', cacheError.message);
        }
      }
      return response;
    })
    .catch(() => null);

  return cached || await fetchPromise || caches.match('/offline.html');
}

const playlistTimestamps = {};
async function playlistStrategy(request) {
  const url = request.url;
  const cache = await caches.open(CACHE_NAMES.M3U);
  const cached = await cache.match(request);
  const now = Date.now();
  const lastTs = playlistTimestamps[url] || 0;
  const withinTTL = now - lastTs < TTL.PLAYLIST;

  if (cached && withinTTL) {
    log('Playlist cache hit (TTL valid):', url);
    return cached;
  }

  try {
    const response = await fetch(request);
    if (response && response.ok) {
      await cache.put(request, response.clone());
      playlistTimestamps[url] = now;
      savePlaylistToIndexedDB(url, await response.clone().text());
      return response;
    }
    if (cached) return cached;
    return tryIndexedDBPlaylist(url);
  } catch (error) {
    log('Playlist fetch failed:', url);
    if (cached) return cached;
    return tryIndexedDBPlaylist(url);
  }
}

async function streamStrategy(request) {
  const cache = await caches.open(CACHE_NAMES.STREAMS);
  const cached = await cache.match(request);

  if (cached) {
    log('Stream cache hit:', request.url);
    return cached;
  }

  try {
    const response = await fetch(request);
    if (response && response.ok) {
      const keys = await cache.keys();
      if (keys.length < CACHE_LIMITS[CACHE_NAMES.STREAMS]) {
        cache.put(request, response.clone());
      }
    }
    return response;
  } catch (error) {
    return new Response('Stream unavailable', { status: 503 });
  }
}

async function imageStrategy(request) {
  const cache = await caches.open(CACHE_NAMES.IMAGES);
  const cached = await cache.match(request);

  if (cached) return cached;

  try {
    const response = await fetch(request);
    if (response && response.ok) {
      const keys = await cache.keys();
      if (keys.length >= CACHE_LIMITS[CACHE_NAMES.IMAGES]) {
        const toDelete = keys.slice(0, 10);
        await Promise.all(toDelete.map(k => cache.delete(k)));
      }
      cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    return new Response('', { status: 404 });
  }
}

// ============ FETCH EVENT ============
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // CRÍTICO: Ignorar URLs que causam problemas
  if (shouldSkipRequest(request.url)) {
    return; // Deixar navegador lidar com isso naturalmente
  }

  if (request.method !== 'GET') {
    event.respondWith(
      fetch(request).catch(() => new Response(null, { status: 503 }))
    );
    return;
  }

  if (request.destination === 'document' || url.pathname.endsWith('.html')) {
    event.respondWith(networkFirst(request));
    return;
  }

  if (['script', 'style', 'font'].includes(request.destination)) {
    event.respondWith(cacheFirst(request, CACHE_NAMES.STATIC));
    return;
  }

  if (request.destination === 'image' || /\.(png|jpg|jpeg|gif|webp|svg|ico)$/i.test(url.pathname)) {
    event.respondWith(imageStrategy(request));
    return;
  }

  if (url.pathname.endsWith('.m3u') || url.pathname.endsWith('.m3u8') || url.pathname.includes('/playlist')) {
    event.respondWith(playlistStrategy(request));
    return;
  }

  if (/\.(ts|m4s|mpd)$/i.test(url.pathname)) {
    event.respondWith(streamStrategy(request));
    return;
  }

  if (url.pathname.startsWith('/api/') || url.hostname.includes('supabase')) {
    event.respondWith(networkFirst(request, CACHE_NAMES.DYNAMIC));
    return;
  }

  event.respondWith(staleWhileRevalidate(request));
});

// ============ PUSH NOTIFICATIONS ============
self.addEventListener('push', (event) => {
  log('Push received');

  let payload = { title: 'IPTV Link', body: 'Nova notificação' };

  if (event.data) {
    try {
      payload = event.data.json();
    } catch {
      payload = { title: 'IPTV Link', body: event.data.text() };
    }
  }

  const options = {
    body: payload.body,
    icon: payload.icon || '/logo.png',
    badge: payload.badge || '/pwa-icon.png',
    image: payload.image,
    data: payload.data || {},
    vibrate: payload.vibrate || [100, 50, 100],
    requireInteraction: !!payload.requireInteraction,
    actions: payload.actions || [],
    tag: payload.tag || 'default',
    renotify: !!payload.renotify
  };

  event.waitUntil(
    self.registration.showNotification(payload.title, options)
  );
});

self.addEventListener('notificationclick', (event) => {
  log('Notification clicked');
  event.notification.close();

  const targetUrl = event.notification.data?.url || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then(windowClients => {
        for (const client of windowClients) {
          if (client.url.includes(self.location.origin) && 'focus' in client) {
            client.navigate(targetUrl);
            return client.focus();
          }
        }
        if (clients.openWindow) {
          return clients.openWindow(targetUrl);
        }
      })
  );
});

// ============ BACKGROUND SYNC ============
self.addEventListener('sync', (event) => {
  log('Sync event:', event.tag);

  switch (event.tag) {
    case 'outbox-sync':
      event.waitUntil(processOutbox());
      break;
    case 'sync-playlist':
      event.waitUntil(syncPlaylist());
      break;
    case 'sync-favorites':
      event.waitUntil(processSyncQueue('sync-favorites'));
      break;
    case 'sync-watch-progress':
      event.waitUntil(processSyncQueue('sync-watch-progress'));
      break;
    default:
      event.waitUntil(processSyncQueue(event.tag));
  }
});

async function processOutbox() {
  log('Processing outbox...');
  try {
    const items = await readAllOutboxItems();
    for (const item of items) {
      try {
        const resp = await fetch(item.url, {
          method: item.method || 'POST',
          headers: item.headers || { 'Content-Type': 'application/json' },
          body: item.body ? JSON.stringify(item.body) : null
        });

        if (resp.ok || resp.status === 201 || resp.status === 204) {
          await removeOutboxItem(item.id);
          log('Outbox item sent:', item.id);
        }
      } catch (err) {
        log('Outbox item failed:', item.id, err);
      }
    }
  } catch (e) {
    console.error('[SW] processOutbox error:', e);
  }
}

async function syncPlaylist() {
  log('Syncing playlist...');
  try {
    const tasks = await getSyncQueue('sync-playlist');
    for (const task of tasks) {
      try {
        const response = await fetch(task.url);
        if (response.ok) {
          const content = await response.text();
          await savePlaylistToIndexedDB(task.url, content);
          await removeSyncTask(task.id);
          log('Playlist synced:', task.url);
        }
      } catch (err) {
        log('Playlist sync failed:', task.url, err);
      }
    }

    const allClients = await clients.matchAll();
    allClients.forEach(client => {
      client.postMessage({ type: 'SYNC_COMPLETE', tag: 'sync-playlist' });
    });
  } catch (e) {
    console.error('[SW] syncPlaylist error:', e);
  }
}

async function processSyncQueue(tag) {
  log('Processing sync queue:', tag);
  try {
    const tasks = await getSyncQueue(tag);
    for (const task of tasks) {
      try {
        const resp = await fetch(task.url, {
          method: task.method,
          headers: task.headers,
          body: task.body ? JSON.stringify(task.body) : null
        });

        if (resp.ok) {
          await removeSyncTask(task.id);
        } else {
          task.retryCount = (task.retryCount || 0) + 1;
          if (task.retryCount >= (task.maxRetries || 3)) {
            await removeSyncTask(task.id);
          }
        }
      } catch (err) {
        log('Sync task failed:', task.id);
      }
    }
  } catch (e) {
    console.error('[SW] processSyncQueue error:', e);
  }
}

// ============ MESSAGE HANDLING ============
self.addEventListener('message', (event) => {
  log('Message received:', event.data);

  switch (event.data?.type) {
    case 'SKIP_WAITING':
      self.skipWaiting();
      break;
    case 'CACHE_URLS':
      event.waitUntil(precacheUrls(event.data.urls, event.data.cacheName));
      break;
    case 'CLEAR_CACHE':
      event.waitUntil(clearCache(event.data.cacheName));
      break;
    case 'GET_CACHE_STATS':
      event.waitUntil(sendCacheStats(event.source));
      break;
  }
});

async function precacheUrls(urls, cacheName) {
  const cache = await caches.open(cacheName || CACHE_NAMES.STATIC);
  await cache.addAll(urls);
  log('Precached URLs:', urls.length);
}

async function clearCache(cacheName) {
  if (cacheName) {
    await caches.delete(cacheName);
  } else {
    const keys = await caches.keys();
    await Promise.all(keys.map(k => caches.delete(k)));
  }
  log('Cache cleared:', cacheName || 'all');
}

async function sendCacheStats(client) {
  const stats = {};
  for (const [name, cacheName] of Object.entries(CACHE_NAMES)) {
    const cache = await caches.open(cacheName);
    const keys = await cache.keys();
    stats[name] = keys.length;
  }
  client.postMessage({ type: 'CACHE_STATS', stats });
}

// ============ INDEXEDDB HELPERS ============
const DB_NAME = 'lovable-db';
const DB_VERSION = 2;

function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('outbox')) {
        db.createObjectStore('outbox', { keyPath: 'id', autoIncrement: true });
      }
      if (!db.objectStoreNames.contains('playlist-cache')) {
        db.createObjectStore('playlist-cache', { keyPath: 'url' });
      }
      if (!db.objectStoreNames.contains('sync-queue')) {
        const store = db.createObjectStore('sync-queue', { keyPath: 'id', autoIncrement: true });
        store.createIndex('by-tag', 'tag', { unique: false });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function readAllOutboxItems() {
  return openDb().then(db =>
    new Promise((resolve, reject) => {
      const tx = db.transaction('outbox', 'readonly');
      const store = tx.objectStore('outbox');
      const items = [];
      store.openCursor().onsuccess = e => {
        const cur = e.target.result;
        if (cur) {
          items.push(cur.value);
          cur.continue();
        } else resolve(items);
      };
      tx.onerror = () => reject(tx.error);
    })
  );
}

function removeOutboxItem(id) {
  return openDb().then(db =>
    new Promise((resolve, reject) => {
      const tx = db.transaction('outbox', 'readwrite');
      tx.objectStore('outbox').delete(id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    })
  );
}

async function savePlaylistToIndexedDB(url, content) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('playlist-cache', 'readwrite');
    tx.objectStore('playlist-cache').put({ url, content, timestamp: Date.now() });
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function tryIndexedDBPlaylist(url) {
  try {
    const db = await openDb();
    return new Promise((resolve) => {
      const tx = db.transaction('playlist-cache', 'readonly');
      const req = tx.objectStore('playlist-cache').get(url);
      req.onsuccess = () => {
        if (req.result) {
          resolve(new Response(req.result.content, {
            headers: { 'Content-Type': 'application/x-mpegurl' }
          }));
        } else {
          resolve(new Response('Playlist not available offline', { status: 503 }));
        }
      };
      req.onerror = () => resolve(new Response('Playlist error', { status: 500 }));
    });
  } catch {
    return new Response('Playlist error', { status: 500 });
  }
}

async function getSyncQueue(tag) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('sync-queue', 'readonly');
    const store = tx.objectStore('sync-queue');
    const index = store.index('by-tag');
    const req = index.getAll(tag);
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
}

async function removeSyncTask(id) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('sync-queue', 'readwrite');
    tx.objectStore('sync-queue').delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

// ============ PERIODIC SYNC ============
self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'update-playlist') {
    event.waitUntil(syncPlaylist());
  }
});

log('Service Worker loaded:', SW_VERSION);
