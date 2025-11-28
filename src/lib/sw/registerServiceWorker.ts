// src/lib/sw/registerServiceWorker.ts
// Service Worker Registration with debug support

const DEBUG = new URLSearchParams(window.location.search).has('debug-sw');

function log(...args: any[]) {
  if (DEBUG) console.log('[SW-Register]', ...args);
}

export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!('serviceWorker' in navigator)) {
    console.warn('[SW] Service Workers não suportados neste navegador');
    return null;
  }

  try {
    const registration = await navigator.serviceWorker.register('/sw.js', {
      scope: '/',
      updateViaCache: 'none'
    });

    log('SW registrado com sucesso:', registration.scope);

    // Check for updates
    registration.addEventListener('updatefound', () => {
      const newWorker = registration.installing;
      log('Nova versão do SW encontrada');

      newWorker?.addEventListener('statechange', () => {
        log('SW state:', newWorker.state);
        if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
          // New SW available, notify user
          dispatchEvent(new CustomEvent('sw-update-available', { detail: registration }));
        }
      });
    });

    // Handle controller change (new SW activated)
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      log('SW controller changed');
    });

    // Message handler from SW
    navigator.serviceWorker.addEventListener('message', (event) => {
      log('Mensagem do SW:', event.data);
      handleSWMessage(event.data);
    });

    return registration;
  } catch (error) {
    console.error('[SW] Falha ao registrar:', error);
    return null;
  }
}

function handleSWMessage(data: any) {
  switch (data.type) {
    case 'CACHE_UPDATED':
      dispatchEvent(new CustomEvent('cache-updated', { detail: data }));
      break;
    case 'SYNC_COMPLETE':
      dispatchEvent(new CustomEvent('sync-complete', { detail: data }));
      break;
    case 'OFFLINE_READY':
      dispatchEvent(new CustomEvent('offline-ready', { detail: data }));
      break;
    default:
      break;
  }
}

export async function checkForUpdates(): Promise<void> {
  const registration = await navigator.serviceWorker.ready;
  await registration.update();
  log('Verificação de atualização iniciada');
}

export async function skipWaiting(): Promise<void> {
  const registration = await navigator.serviceWorker.ready;
  registration.waiting?.postMessage({ type: 'SKIP_WAITING' });
}

export function sendMessageToSW(message: any): void {
  navigator.serviceWorker.controller?.postMessage(message);
}
