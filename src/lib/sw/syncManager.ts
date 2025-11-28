// src/lib/sw/syncManager.ts
// Background Sync Manager

import { openDB, saveToStore, getAllFromStore, deleteFromStore } from '../utils/indexedDB';

const DEBUG = new URLSearchParams(window.location.search).has('debug-sync');

function log(...args: any[]) {
  if (DEBUG) console.log('[Sync]', ...args);
}

export type SyncTag = 
  | 'sync-playlist'
  | 'sync-favorites'
  | 'sync-watch-progress'
  | 'sync-settings'
  | 'outbox-sync';

interface SyncTask {
  id?: number;
  tag: SyncTag;
  url: string;
  method: string;
  headers: Record<string, string>;
  body: any;
  createdAt: number;
  retryCount: number;
  maxRetries: number;
}

export async function registerSync(tag: SyncTag): Promise<boolean> {
  if (!('serviceWorker' in navigator) || !('SyncManager' in window)) {
    log('Background Sync não suportado');
    return false;
  }

  try {
    const registration = await navigator.serviceWorker.ready;
    await (registration as any).sync.register(tag);
    log(`Sync '${tag}' registrado`);
    return true;
  } catch (error) {
    console.error('[Sync] Erro ao registrar:', error);
    return false;
  }
}

export async function addToSyncQueue(task: Omit<SyncTask, 'id' | 'createdAt' | 'retryCount'>): Promise<number | null> {
  try {
    const fullTask: SyncTask = {
      ...task,
      createdAt: Date.now(),
      retryCount: 0,
      maxRetries: task.maxRetries || 3
    };

    const id = await saveToStore('sync-queue', fullTask);
    log('Task adicionada à fila:', id);

    // Register sync
    await registerSync(task.tag);

    return id as number;
  } catch (error) {
    console.error('[Sync] Erro ao adicionar à fila:', error);
    return null;
  }
}

export async function getSyncQueue(): Promise<SyncTask[]> {
  try {
    return await getAllFromStore('sync-queue');
  } catch {
    return [];
  }
}

export async function removeFromSyncQueue(id: number): Promise<void> {
  await deleteFromStore('sync-queue', id);
  log('Task removida da fila:', id);
}

export async function processSyncQueue(tag?: SyncTag): Promise<{ success: number; failed: number }> {
  const queue = await getSyncQueue();
  const tasks = tag ? queue.filter(t => t.tag === tag) : queue;

  let success = 0;
  let failed = 0;

  for (const task of tasks) {
    try {
      const response = await fetch(task.url, {
        method: task.method,
        headers: task.headers,
        body: task.body ? JSON.stringify(task.body) : undefined
      });

      if (response.ok) {
        await removeFromSyncQueue(task.id!);
        success++;
        log('Task processada com sucesso:', task.id);
      } else {
        throw new Error(`HTTP ${response.status}`);
      }
    } catch (error) {
      failed++;
      task.retryCount++;

      if (task.retryCount >= task.maxRetries) {
        await removeFromSyncQueue(task.id!);
        log('Task removida após max retries:', task.id);
      } else {
        await saveToStore('sync-queue', task);
        log('Task marcada para retry:', task.id);
      }
    }
  }

  return { success, failed };
}

// Playlist-specific sync functions
export async function queuePlaylistSync(playlistUrl: string): Promise<void> {
  await addToSyncQueue({
    tag: 'sync-playlist',
    url: playlistUrl,
    method: 'GET',
    headers: { 'Accept': 'application/x-mpegurl' },
    body: null,
    maxRetries: 5
  });
}

export async function queueFavoriteSync(channelId: string, action: 'add' | 'remove'): Promise<void> {
  await addToSyncQueue({
    tag: 'sync-favorites',
    url: '/api/favorites',
    method: action === 'add' ? 'POST' : 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: { channelId },
    maxRetries: 3
  });
}

export async function queueWatchProgressSync(
  contentId: string,
  progress: number,
  duration: number
): Promise<void> {
  await addToSyncQueue({
    tag: 'sync-watch-progress',
    url: '/api/watch-progress',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: { contentId, progress, duration, timestamp: Date.now() },
    maxRetries: 3
  });
}

export function isSyncSupported(): boolean {
  return 'serviceWorker' in navigator && 'SyncManager' in window;
}

// Network status helpers
export function isOnline(): boolean {
  return navigator.onLine;
}

export function onNetworkChange(callback: (online: boolean) => void): () => void {
  const onlineHandler = () => callback(true);
  const offlineHandler = () => callback(false);

  window.addEventListener('online', onlineHandler);
  window.addEventListener('offline', offlineHandler);

  return () => {
    window.removeEventListener('online', onlineHandler);
    window.removeEventListener('offline', offlineHandler);
  };
}
