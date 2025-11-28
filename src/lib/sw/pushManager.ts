// src/lib/sw/pushManager.ts
// Push Notification Manager

const DEBUG = new URLSearchParams(window.location.search).has('debug-sw');

function log(...args: any[]) {
  if (DEBUG) console.log('[Push]', ...args);
}

// VAPID public key - should be configured in environment
const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY || '';

function urlBase64ToUint8Array(base64String: string): ArrayBuffer {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray.buffer as ArrayBuffer;
}

export async function requestPushPermission(): Promise<NotificationPermission> {
  if (!('Notification' in window)) {
    console.warn('[Push] Notifications não suportadas');
    return 'denied';
  }

  const permission = await Notification.requestPermission();
  log('Permissão de notificação:', permission);
  return permission;
}

export async function subscribeToPush(): Promise<PushSubscription | null> {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    console.warn('[Push] Push não suportado');
    return null;
  }

  try {
    const registration = await navigator.serviceWorker.ready;

    // Check existing subscription
    let subscription = await registration.pushManager.getSubscription();

    if (subscription) {
      log('Subscription existente encontrada');
      return subscription;
    }

    if (!VAPID_PUBLIC_KEY) {
      console.warn('[Push] VAPID key não configurada');
      return null;
    }

    // Create new subscription
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
    });

    log('Nova subscription criada:', subscription.endpoint);

    // Send subscription to backend
    await sendSubscriptionToServer(subscription);

    return subscription;
  } catch (error) {
    console.error('[Push] Erro ao criar subscription:', error);
    return null;
  }
}

export async function unsubscribeFromPush(): Promise<boolean> {
  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();

    if (subscription) {
      await subscription.unsubscribe();
      await removeSubscriptionFromServer(subscription);
      log('Unsubscribed com sucesso');
      return true;
    }

    return false;
  } catch (error) {
    console.error('[Push] Erro ao unsubscribe:', error);
    return false;
  }
}

async function sendSubscriptionToServer(subscription: PushSubscription): Promise<void> {
  // TODO: Integrate with your backend
  log('Enviando subscription para o servidor:', subscription.toJSON());

  // Example implementation:
  // await fetch('/api/push/subscribe', {
  //   method: 'POST',
  //   headers: { 'Content-Type': 'application/json' },
  //   body: JSON.stringify(subscription.toJSON())
  // });
}

async function removeSubscriptionFromServer(subscription: PushSubscription): Promise<void> {
  // TODO: Integrate with your backend
  log('Removendo subscription do servidor');

  // Example implementation:
  // await fetch('/api/push/unsubscribe', {
  //   method: 'POST',
  //   headers: { 'Content-Type': 'application/json' },
  //   body: JSON.stringify({ endpoint: subscription.endpoint })
  // });
}

export async function getPushSubscription(): Promise<PushSubscription | null> {
  try {
    const registration = await navigator.serviceWorker.ready;
    return await registration.pushManager.getSubscription();
  } catch {
    return null;
  }
}

export function isPushSupported(): boolean {
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
}

export async function showLocalNotification(
  title: string,
  options?: NotificationOptions
): Promise<void> {
  if (Notification.permission !== 'granted') {
    console.warn('[Push] Permissão não concedida');
    return;
  }

  const registration = await navigator.serviceWorker.ready;
  await registration.showNotification(title, {
    icon: '/logo.png',
    badge: '/pwa-icon.png',
    ...options
  });
}
