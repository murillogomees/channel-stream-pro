// src/hooks/useServiceWorker.ts
// React hook for Service Worker management

import { useEffect, useState, useCallback } from 'react';
import { 
  registerServiceWorker, 
  checkForUpdates, 
  skipWaiting,
  sendMessageToSW 
} from '@/lib/sw/registerServiceWorker';
import { 
  requestPushPermission, 
  subscribeToPush, 
  isPushSupported,
  getPushSubscription
} from '@/lib/sw/pushManager';
import { 
  isOnline, 
  onNetworkChange, 
  isSyncSupported 
} from '@/lib/sw/syncManager';
import { 
  getAllCacheStats, 
  getStorageEstimate, 
  requestPersistentStorage,
  runCacheCleanup
} from '@/lib/sw/cacheStrategies';

interface ServiceWorkerState {
  isRegistered: boolean;
  isOnline: boolean;
  updateAvailable: boolean;
  pushPermission: NotificationPermission;
  pushSubscribed: boolean;
  cacheStats: Record<string, number>;
  storageUsage: { usage: number; quota: number } | null;
}

export function useServiceWorker() {
  const [state, setState] = useState<ServiceWorkerState>({
    isRegistered: false,
    isOnline: navigator.onLine,
    updateAvailable: false,
    pushPermission: 'default',
    pushSubscribed: false,
    cacheStats: {},
    storageUsage: null
  });

  const [registration, setRegistration] = useState<ServiceWorkerRegistration | null>(null);

  // Initialize SW on mount
  useEffect(() => {
    let mounted = true;

    async function init() {
      const reg = await registerServiceWorker();
      if (!mounted) return;

      setRegistration(reg);
      setState(prev => ({ ...prev, isRegistered: !!reg }));

      // Check push status
      if (isPushSupported()) {
        const permission = Notification.permission;
        const subscription = await getPushSubscription();
        setState(prev => ({
          ...prev,
          pushPermission: permission,
          pushSubscribed: !!subscription
        }));
      }

      // Get cache stats
      const stats = await getAllCacheStats();
      const storage = await getStorageEstimate();
      setState(prev => ({ ...prev, cacheStats: stats, storageUsage: storage }));
    }

    init();

    // Listen for network changes
    const unsubscribe = onNetworkChange((online) => {
      setState(prev => ({ ...prev, isOnline: online }));
    });

    // Listen for SW update available
    const handleUpdate = () => {
      setState(prev => ({ ...prev, updateAvailable: true }));
    };
    window.addEventListener('sw-update-available', handleUpdate);

    return () => {
      mounted = false;
      unsubscribe();
      window.removeEventListener('sw-update-available', handleUpdate);
    };
  }, []);

  // Request push permission and subscribe
  const enablePush = useCallback(async () => {
    const permission = await requestPushPermission();
    setState(prev => ({ ...prev, pushPermission: permission }));

    if (permission === 'granted') {
      const subscription = await subscribeToPush();
      setState(prev => ({ ...prev, pushSubscribed: !!subscription }));
      return !!subscription;
    }
    return false;
  }, []);

  // Apply SW update
  const applyUpdate = useCallback(async () => {
    await skipWaiting();
    window.location.reload();
  }, []);

  // Check for updates manually
  const checkUpdate = useCallback(async () => {
    await checkForUpdates();
  }, []);

  // Clear caches
  const clearCaches = useCallback(async (cacheName?: string) => {
    sendMessageToSW({ type: 'CLEAR_CACHE', cacheName });
    const stats = await getAllCacheStats();
    setState(prev => ({ ...prev, cacheStats: stats }));
  }, []);

  // Run cache cleanup
  const cleanup = useCallback(async () => {
    await runCacheCleanup();
    const stats = await getAllCacheStats();
    setState(prev => ({ ...prev, cacheStats: stats }));
  }, []);

  // Request persistent storage
  const requestPersistence = useCallback(async () => {
    return await requestPersistentStorage();
  }, []);

  // Refresh stats
  const refreshStats = useCallback(async () => {
    const stats = await getAllCacheStats();
    const storage = await getStorageEstimate();
    setState(prev => ({ ...prev, cacheStats: stats, storageUsage: storage }));
  }, []);

  return {
    ...state,
    registration,
    enablePush,
    applyUpdate,
    checkUpdate,
    clearCaches,
    cleanup,
    requestPersistence,
    refreshStats,
    isPushSupported: isPushSupported(),
    isSyncSupported: isSyncSupported()
  };
}
