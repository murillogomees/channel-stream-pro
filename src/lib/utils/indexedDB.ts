// src/lib/utils/indexedDB.ts
// IndexedDB utilities for offline data persistence

const DB_NAME = 'lovable-db';
const DB_VERSION = 2;

const DEBUG = new URLSearchParams(window.location.search).has('debug-sw');

function log(...args: any[]) {
  if (DEBUG) console.log('[IndexedDB]', ...args);
}

export interface PlaylistEntry {
  id?: number;
  name: string;
  url: string;
  logo?: string;
  category: string;
  groupTitle?: string;
  tvgId?: string;
  metadata?: Record<string, any>;
  updatedAt: number;
}

export interface WatchProgress {
  id?: number;
  contentId: string;
  contentType: 'channel' | 'movie' | 'series';
  progress: number;
  duration: number;
  timestamp: number;
}

export interface UserSettings {
  id?: number;
  key: string;
  value: any;
  updatedAt: number;
}

export interface CachedImage {
  id?: number;
  url: string;
  blob: Blob;
  cachedAt: number;
}

const STORES = {
  OUTBOX: 'outbox',
  PLAYLIST: 'playlist',
  WATCH_PROGRESS: 'watch-progress',
  SETTINGS: 'settings',
  FAVORITES: 'favorites',
  IMAGES: 'images',
  SYNC_QUEUE: 'sync-queue',
  EPG: 'epg'
} as const;

type StoreName = typeof STORES[keyof typeof STORES];

let dbInstance: IDBDatabase | null = null;

export function openDB(): Promise<IDBDatabase> {
  if (dbInstance) return Promise.resolve(dbInstance);

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = request.result;
      log('Upgrade do DB, versão:', event.oldVersion, '->', event.newVersion);

      // Outbox store for offline requests
      if (!db.objectStoreNames.contains(STORES.OUTBOX)) {
        db.createObjectStore(STORES.OUTBOX, { keyPath: 'id', autoIncrement: true });
      }

      // Playlist store
      if (!db.objectStoreNames.contains(STORES.PLAYLIST)) {
        const playlistStore = db.createObjectStore(STORES.PLAYLIST, { keyPath: 'id', autoIncrement: true });
        playlistStore.createIndex('by-category', 'category', { unique: false });
        playlistStore.createIndex('by-name', 'name', { unique: false });
      }

      // Watch progress store
      if (!db.objectStoreNames.contains(STORES.WATCH_PROGRESS)) {
        const progressStore = db.createObjectStore(STORES.WATCH_PROGRESS, { keyPath: 'id', autoIncrement: true });
        progressStore.createIndex('by-content', 'contentId', { unique: true });
      }

      // Settings store
      if (!db.objectStoreNames.contains(STORES.SETTINGS)) {
        const settingsStore = db.createObjectStore(STORES.SETTINGS, { keyPath: 'id', autoIncrement: true });
        settingsStore.createIndex('by-key', 'key', { unique: true });
      }

      // Favorites store
      if (!db.objectStoreNames.contains(STORES.FAVORITES)) {
        const favStore = db.createObjectStore(STORES.FAVORITES, { keyPath: 'id', autoIncrement: true });
        favStore.createIndex('by-channel', 'channelId', { unique: true });
      }

      // Sync queue store
      if (!db.objectStoreNames.contains(STORES.SYNC_QUEUE)) {
        const syncStore = db.createObjectStore(STORES.SYNC_QUEUE, { keyPath: 'id', autoIncrement: true });
        syncStore.createIndex('by-tag', 'tag', { unique: false });
      }

      // EPG store
      if (!db.objectStoreNames.contains(STORES.EPG)) {
        const epgStore = db.createObjectStore(STORES.EPG, { keyPath: 'id', autoIncrement: true });
        epgStore.createIndex('by-channel', 'channelId', { unique: false });
        epgStore.createIndex('by-time', 'startTime', { unique: false });
      }

      // Images cache store
      if (!db.objectStoreNames.contains(STORES.IMAGES)) {
        const imgStore = db.createObjectStore(STORES.IMAGES, { keyPath: 'id', autoIncrement: true });
        imgStore.createIndex('by-url', 'url', { unique: true });
      }
    };

    request.onsuccess = () => {
      dbInstance = request.result;
      log('DB aberto com sucesso');
      resolve(dbInstance);
    };

    request.onerror = () => {
      console.error('[IndexedDB] Erro ao abrir:', request.error);
      reject(request.error);
    };
  });
}

export async function saveToStore<T>(storeName: StoreName, data: T): Promise<IDBValidKey> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    const request = store.put(data);

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function getFromStore<T>(storeName: StoreName, key: IDBValidKey): Promise<T | undefined> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly');
    const store = tx.objectStore(storeName);
    const request = store.get(key);

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function getAllFromStore<T>(storeName: StoreName): Promise<T[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly');
    const store = tx.objectStore(storeName);
    const request = store.getAll();

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function deleteFromStore(storeName: StoreName, key: IDBValidKey): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    const request = store.delete(key);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function clearStore(storeName: StoreName): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    const request = store.clear();

    request.onsuccess = () => {
      log(`Store '${storeName}' limpo`);
      resolve();
    };
    request.onerror = () => reject(request.error);
  });
}

export async function getByIndex<T>(
  storeName: StoreName,
  indexName: string,
  value: IDBValidKey
): Promise<T[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly');
    const store = tx.objectStore(storeName);
    const index = store.index(indexName);
    const request = index.getAll(value);

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// Playlist-specific functions
export async function savePlaylist(entries: PlaylistEntry[]): Promise<void> {
  const db = await openDB();
  const tx = db.transaction(STORES.PLAYLIST, 'readwrite');
  const store = tx.objectStore(STORES.PLAYLIST);

  // Clear existing and add new
  await store.clear();
  for (const entry of entries) {
    store.add({ ...entry, updatedAt: Date.now() });
  }

  return new Promise((resolve, reject) => {
    tx.oncomplete = () => {
      log(`Playlist salva: ${entries.length} entradas`);
      resolve();
    };
    tx.onerror = () => reject(tx.error);
  });
}

export async function getPlaylist(): Promise<PlaylistEntry[]> {
  return getAllFromStore<PlaylistEntry>(STORES.PLAYLIST);
}

export async function getPlaylistByCategory(category: string): Promise<PlaylistEntry[]> {
  return getByIndex<PlaylistEntry>(STORES.PLAYLIST, 'by-category', category);
}

// Watch progress functions
export async function saveWatchProgress(progress: Omit<WatchProgress, 'id'>): Promise<void> {
  const existing = await getByIndex<WatchProgress>(
    STORES.WATCH_PROGRESS,
    'by-content',
    progress.contentId
  );

  if (existing.length > 0) {
    await saveToStore(STORES.WATCH_PROGRESS, { ...progress, id: existing[0].id });
  } else {
    await saveToStore(STORES.WATCH_PROGRESS, progress);
  }
}

export async function getWatchProgress(contentId: string): Promise<WatchProgress | undefined> {
  const results = await getByIndex<WatchProgress>(STORES.WATCH_PROGRESS, 'by-content', contentId);
  return results[0];
}

// Settings functions
export async function saveSetting(key: string, value: any): Promise<void> {
  const existing = await getByIndex<UserSettings>(STORES.SETTINGS, 'by-key', key);
  const data: UserSettings = {
    key,
    value,
    updatedAt: Date.now(),
    ...(existing.length > 0 ? { id: existing[0].id } : {})
  };
  await saveToStore(STORES.SETTINGS, data);
}

export async function getSetting<T>(key: string): Promise<T | undefined> {
  const results = await getByIndex<UserSettings>(STORES.SETTINGS, 'by-key', key);
  return results[0]?.value;
}

// Favorites functions
export async function addFavorite(channelId: string): Promise<void> {
  await saveToStore(STORES.FAVORITES, { channelId, addedAt: Date.now() });
}

export async function removeFavorite(channelId: string): Promise<void> {
  const favorites = await getByIndex<{ id: number; channelId: string }>(
    STORES.FAVORITES,
    'by-channel',
    channelId
  );
  if (favorites.length > 0) {
    await deleteFromStore(STORES.FAVORITES, favorites[0].id);
  }
}

export async function getFavorites(): Promise<string[]> {
  const all = await getAllFromStore<{ channelId: string }>(STORES.FAVORITES);
  return all.map(f => f.channelId);
}

export async function isFavorite(channelId: string): Promise<boolean> {
  const results = await getByIndex(STORES.FAVORITES, 'by-channel', channelId);
  return results.length > 0;
}

export { STORES };
