// public/sw.js
// Lovable - Service Worker (v1.0)
// Coloque este arquivo na raiz pública (/public/sw.js) para garantir scope "/"

const SW_VERSION = "lovable-sw-v1.0";
const PRECACHE = `${SW_VERSION}-precache`;
const RUNTIME = `${SW_VERSION}-runtime`;

// Atualize os assets conforme seu build (ex.: Vite/React produz nomes diferentes — adapte)
const PRECACHE_URLS = [
  "/",
  "/index.html",
  "/offline.html",
  "/favicon.ico",
  "/favicon.png",
  "/logo.webp", // ajustar para seu bundle
  "/pwa-icon.png", // ajustar para seu bundle
  "/logo.png",
];

// TTL para playlists (em ms) — 5 minutos
const PLAYLIST_TTL = 5 * 60 * 1000;

// Simple map to track cached playlist timestamps
// OBS: isso não sobrevive restart do SW; para persistência use IndexedDB se quiser.
const playlistTimestamps = {};

self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches
      .open(PRECACHE)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .catch((err) => console.error("[SW] Precache falhou", err)),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      clients.claim();
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k !== PRECACHE && k !== RUNTIME).map((k) => caches.delete(k)));
    })(),
  );
});

// ------------ Helpers: strategies ------------
async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response && response.ok) {
    const cache = await caches.open(RUNTIME);
    cache.put(request, response.clone());
  }
  return response;
}

async function networkFirst(request, options = {}) {
  const cache = await caches.open(RUNTIME);
  try {
    const response = await fetch(request, options);
    if (response && response.ok) cache.put(request, response.clone());
    return response;
  } catch (err) {
    const cached = await cache.match(request);
    if (cached) return cached;
    return caches.match("/offline.html");
  }
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(RUNTIME);
  const cached = await cache.match(request);
  const fetchPromise = fetch(request)
    .then((resp) => {
      if (resp && resp.ok) cache.put(request, resp.clone());
      return resp;
    })
    .catch(() => null);
  return cached || (await fetchPromise) || caches.match("/offline.html");
}

// Small helper to check playlist TTL
async function servePlaylistWithTTL(request) {
  const url = request.url;
  const cache = await caches.open(RUNTIME);
  const cached = await cache.match(request);
  const now = Date.now();
  const lastTs = playlistTimestamps[url] || 0;
  const withinTTL = now - lastTs < PLAYLIST_TTL;

  if (cached && withinTTL) {
    // Serve cached short-lived playlist
    return cached;
  }

  try {
    const response = await fetch(request);
    if (response && response.ok) {
      await cache.put(request, response.clone());
      playlistTimestamps[url] = Date.now();
      return response;
    }
    if (cached) return cached;
    return caches.match("/offline.html");
  } catch (e) {
    if (cached) return cached;
    return caches.match("/offline.html");
  }
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Allow non-GET passthrough (but can be enqueued on outbox)
  if (request.method !== "GET") {
    // For POST/PUT you probably want to try network, otherwise save to outbox on client.
    event.respondWith(fetch(request).catch(() => new Response(null, { status: 503 })));
    return;
  }

  // Documents (HTML) -> network-first
  if (request.destination === "document" || url.pathname.endsWith(".html")) {
    event.respondWith(networkFirst(request));
    return;
  }

  // Static assets -> cache-first
  if (["script", "style", "image", "font"].includes(request.destination)) {
    event.respondWith(cacheFirst(request));
    return;
  }

  // Playlist / m3u -> short TTL logic
  if (url.pathname.endsWith(".m3u") || url.pathname.includes("/playlist")) {
    event.respondWith(servePlaylistWithTTL(request));
    return;
  }

  // API calls -> network-first with cache fallback
  if (
    url.pathname.startsWith("/api/") ||
    (url.hostname === self.location.hostname && url.pathname.startsWith("/api/"))
  ) {
    event.respondWith(networkFirst(request));
    return;
  }

  // Fallback generic: stale-while-revalidate
  event.respondWith(staleWhileRevalidate(request));
});

// ---------- Push ----------
self.addEventListener("push", (event) => {
  let payload = { title: "Lovable", body: "Notificação" };
  if (event.data) {
    try {
      payload = event.data.json();
    } catch (e) {
      payload = { title: "Lovable", body: event.data.text() };
    }
  }

  const options = {
    body: payload.body,
    icon: payload.icon || "/logo192.png",
    badge: payload.badge || "/logo192.png",
    data: payload.data || {},
    vibrate: payload.vibrate || [100, 50, 100],
    requireInteraction: !!payload.requireInteraction,
  };

  event.waitUntil(self.registration.showNotification(payload.title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data && event.notification.data.url ? event.notification.data.url : "/";
  event.waitUntil(
    clients.matchAll({ type: "window" }).then((windowClients) => {
      for (const client of windowClients) {
        if (client.url === url && "focus" in client) return client.focus();
      }
      if (clients.openWindow) return clients.openWindow(url);
    }),
  );
});

// ---------- Background Sync ----------
self.addEventListener("sync", (event) => {
  if (event.tag === "outbox-sync") {
    event.waitUntil(processOutbox());
  }
});

// Process outbox - adapt to suas rotas e formato do payload
async function processOutbox() {
  // Implementação leve: usamos IndexedDB (idb) no cliente; aqui apenas chamamos a função que o cliente populou.
  // Para simplicidade, implementamos a leitura do outbox via IndexedDB direto no SW.
  try {
    const items = await readAllOutboxItems(); // defined below
    for (const item of items) {
      try {
        const resp = await fetch(item.url, {
          method: item.method || "POST",
          headers: item.headers || { "Content-Type": "application/json" },
          body: item.body ? JSON.stringify(item.body) : null,
        });
        if (resp && (resp.status === 200 || resp.status === 201 || resp.status === 204)) {
          await removeOutboxItem(item.id);
        }
      } catch (err) {
        console.error("[SW][outbox] envio falhou, manter item", item.id, err);
      }
    }
  } catch (e) {
    console.error("[SW][outbox] processOutbox erro", e);
  }
}

/* ---------- Minimal IndexedDB helpers usable pelo SW ----------
  Nota: IndexedDB no Service Worker é disponível. Vamos criar uma store 'outbox' para itens pendentes.
  As funções abaixo são simples e suficientes — para produção considere idb library.
*/
function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open("lovable-db", 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains("outbox")) {
        db.createObjectStore("outbox", { keyPath: "id", autoIncrement: true });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function readAllOutboxItems() {
  return openDb().then(
    (db) =>
      new Promise((resolve, reject) => {
        const tx = db.transaction("outbox", "readonly");
        const store = tx.objectStore("outbox");
        const items = [];
        store.openCursor().onsuccess = (e) => {
          const cur = e.target.result;
          if (cur) {
            items.push(cur.value);
            cur.continue();
          } else resolve(items);
        };
        tx.oncomplete = () => db.close();
        tx.onerror = () => reject(tx.error);
      }),
  );
}

function removeOutboxItem(id) {
  return openDb().then(
    (db) =>
      new Promise((resolve, reject) => {
        const tx = db.transaction("outbox", "readwrite");
        tx.objectStore("outbox").delete(id);
        tx.oncomplete = () => {
          db.close();
          resolve();
        };
        tx.onerror = () => {
          db.close();
          reject(tx.error);
        };
      }),
  );
}
