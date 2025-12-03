/**
 * IndexedDB Cache for M3U entries - stores entries locally for instant reload
 */

const DB_NAME = 'm3u_entries_cache';
const DB_VERSION = 1;
const STORE_NAME = 'entries';
const META_STORE = 'meta';

interface CacheMeta {
  sourceId: string;
  timestamp: number;
  count: number;
}

let dbInstance: IDBDatabase | null = null;

async function openDB(): Promise<IDBDatabase> {
  if (dbInstance) return dbInstance;

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      dbInstance = request.result;
      resolve(dbInstance);
    };

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('source_id', 'source_id', { unique: false });
      }
      
      if (!db.objectStoreNames.contains(META_STORE)) {
        db.createObjectStore(META_STORE, { keyPath: 'sourceId' });
      }
    };
  });
}

export async function getCachedEntries(sourceId: string): Promise<any[] | null> {
  try {
    const db = await openDB();
    
    // Check if cache is valid (less than 1 hour old)
    const meta = await new Promise<CacheMeta | null>((resolve, reject) => {
      const tx = db.transaction(META_STORE, 'readonly');
      const store = tx.objectStore(META_STORE);
      const request = store.get(sourceId);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result || null);
    });

    if (!meta || Date.now() - meta.timestamp > 60 * 60 * 1000) {
      return null; // Cache expired or doesn't exist
    }

    // Get entries from cache
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const index = store.index('source_id');
      const request = index.getAll(sourceId);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
    });
  } catch (error) {
    console.warn('[M3UCache] Error reading cache:', error);
    return null;
  }
}

export async function setCachedEntries(sourceId: string, entries: any[]): Promise<void> {
  try {
    const db = await openDB();
    
    // Clear old entries for this source
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const index = store.index('source_id');
      const request = index.openCursor(sourceId);
      
      request.onerror = () => reject(request.error);
      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;
        if (cursor) {
          cursor.delete();
          cursor.continue();
        }
      };
      
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });

    // Add new entries in chunks
    const CHUNK_SIZE = 1000;
    for (let i = 0; i < entries.length; i += CHUNK_SIZE) {
      const chunk = entries.slice(i, i + CHUNK_SIZE);
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        chunk.forEach(entry => store.put(entry));
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    }

    // Update meta
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(META_STORE, 'readwrite');
      const store = tx.objectStore(META_STORE);
      store.put({ sourceId, timestamp: Date.now(), count: entries.length });
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });

    console.log(`[M3UCache] Cached ${entries.length} entries for source ${sourceId}`);
  } catch (error) {
    console.warn('[M3UCache] Error writing cache:', error);
  }
}

export async function clearCache(sourceId?: string): Promise<void> {
  try {
    const db = await openDB();
    
    if (sourceId) {
      // Clear specific source
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction([STORE_NAME, META_STORE], 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        const index = store.index('source_id');
        const request = index.openCursor(sourceId);
        
        request.onsuccess = (event) => {
          const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;
          if (cursor) {
            cursor.delete();
            cursor.continue();
          }
        };
        
        tx.objectStore(META_STORE).delete(sourceId);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    } else {
      // Clear all
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction([STORE_NAME, META_STORE], 'readwrite');
        tx.objectStore(STORE_NAME).clear();
        tx.objectStore(META_STORE).clear();
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    }
  } catch (error) {
    console.warn('[M3UCache] Error clearing cache:', error);
  }
}

export async function getCacheMeta(sourceId: string): Promise<CacheMeta | null> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(META_STORE, 'readonly');
      const store = tx.objectStore(META_STORE);
      const request = store.get(sourceId);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result || null);
    });
  } catch {
    return null;
  }
}
