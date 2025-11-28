// src/outbox.js
// Minimal Outbox helper para salvar requests quando offline e registrar Background Sync

// Uso: await saveRequestToOutbox({ url: '/api/send', method: 'POST', body: { ... } });

export async function saveRequestToOutbox(item) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('outbox', 'readwrite');
    const store = tx.objectStore('outbox');
    const toSave = {
      url: item.url,
      method: item.method || 'POST',
      headers: item.headers || { 'Content-Type': 'application/json' },
      body: item.body || null,
      createdAt: Date.now()
    };
    const req = store.add(toSave);
    req.onsuccess = () => {
      tx.oncomplete = async () => {
        db.close();
        // tenta registrar sync
        if ('serviceWorker' in navigator && 'SyncManager' in window) {
          try {
            const reg = await navigator.serviceWorker.ready;
            await reg.sync.register('outbox-sync');
            console.log('[outbox] sync registrado');
          } catch (err) {
            console.warn('[outbox] não foi possível registrar sync', err);
          }
        }
        resolve(req.result);
      };
    };
    req.onerror = () => {
      db.close();
      reject(req.error);
    };
  });
}

export async function listOutboxItems() {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('outbox', 'readonly');
    const store = tx.objectStore('outbox');
    const items = [];
    store.openCursor().onsuccess = e => {
      const cur = e.target.result;
      if (cur) {
        items.push(cur.value);
        cur.continue();
      } else {
        db.close();
        resolve(items);
      }
    };
    tx.onerror = () => { db.close(); reject(tx.error); };
  });
}

// recreate same openDb used in SW (version must match)
function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('lovable-db', 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('outbox')) {
        db.createObjectStore('outbox', { keyPath: 'id', autoIncrement: true });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
