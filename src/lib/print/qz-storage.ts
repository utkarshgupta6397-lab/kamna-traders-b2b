/**
 * IndexedDB storage for QZ Tray local configuration.
 * Stores machine-specific certificates and private keys securely in the browser.
 */

const DB_NAME = 'kamna_qz_store';
const STORE_NAME = 'config';
const DB_VERSION = 1;

export interface QZConfig {
  id: 'current_setup';
  certificate: string;
  privateKey: string;
  printerName: string;
  configuredAt: string;
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function saveQZConfig(config: Omit<QZConfig, 'id'>): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.put({ id: 'current_setup', ...config });

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function getQZConfig(): Promise<QZConfig | null> {
  if (typeof window === 'undefined') return null;
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.get('current_setup');

      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  } catch (err) {
    console.warn('[QZ_STORAGE] Failed to get config:', err);
    return null;
  }
}

export async function clearQZConfig(): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.delete('current_setup');

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}
