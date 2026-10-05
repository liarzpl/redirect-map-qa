/**
 * İsteğe bağlı yerel saklama (IndexedDB).
 * Varsayılan KAPALI — config.LOCAL_STORAGE_ENABLED ile açılır.
 *
 * - localStorage'a hassas veri YAZILMAZ
 * - Açılınca navigator.storage.persist() çağrılır
 * - 'Excel'e yedekle' hatırlatması, tümünü sil, dışa aktar
 * - Veri yalnız bu cihazda kalır
 */

import { BACKUP_REMIND_DAYS, LOCAL_STORAGE_ENABLED } from '../config';
import { t, type Lang } from './i18n';
import { logger } from './logger';

const DB_NAME = 'tarayici-arac-db';
const DB_VERSION = 1;
const STORE = 'records';
const META_STORE = 'meta';

export interface StorageMeta {
  lastBackupAt: number | null;
}

function notEnabled(): never {
  throw new Error('Yerel saklama kapalı (LOCAL_STORAGE_ENABLED=false).');
}

export function isStorageEnabled(): boolean {
  return LOCAL_STORAGE_ENABLED;
}

async function openDb(): Promise<IDBDatabase> {
  if (!LOCAL_STORAGE_ENABLED) notEnabled();
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onerror = () => reject(new Error('IndexedDB açılamadı.'));
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'id', autoIncrement: true });
      }
      if (!db.objectStoreNames.contains(META_STORE)) {
        db.createObjectStore(META_STORE);
      }
    };
    req.onsuccess = () => resolve(req.result);
  });
}

/** Kalıcı depolama iste (tarayıcı izin verirse). */
export async function requestPersistentStorage(): Promise<boolean> {
  if (!LOCAL_STORAGE_ENABLED) return false;
  try {
    if (navigator.storage?.persist) {
      const granted = await navigator.storage.persist();
      logger.info(granted ? 'Kalıcı depolama açık' : 'Kalıcı depolama yok');
      return granted;
    }
  } catch {
    logger.warn('Kalıcı depolama isteği başarısız');
  }
  return false;
}

export async function saveRecords(
  records: Record<string, unknown>[],
): Promise<void> {
  if (!LOCAL_STORAGE_ENABLED) notEnabled();
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    const store = tx.objectStore(STORE);
    store.clear();
    for (const r of records) {
      store.add({ ...r });
    }
    tx.oncomplete = () => {
      db.close();
      logger.info('Yerel kayıtlar güncellendi');
      resolve();
    };
    tx.onerror = () => {
      db.close();
      reject(new Error('Kayıt yazılamadı.'));
    };
  });
}

export async function loadRecords(): Promise<Record<string, unknown>[]> {
  if (!LOCAL_STORAGE_ENABLED) return [];
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly');
    const req = tx.objectStore(STORE).getAll();
    req.onsuccess = () => {
      db.close();
      resolve(req.result as Record<string, unknown>[]);
    };
    req.onerror = () => {
      db.close();
      reject(new Error('Kayıtlar okunamadı.'));
    };
  });
}

export async function clearAllData(): Promise<void> {
  if (!LOCAL_STORAGE_ENABLED) notEnabled();
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction([STORE, META_STORE], 'readwrite');
    tx.objectStore(STORE).clear();
    tx.objectStore(META_STORE).clear();
    tx.oncomplete = () => {
      db.close();
      logger.info('Tüm yerel veri silindi');
      resolve();
    };
    tx.onerror = () => {
      db.close();
      reject(new Error('Silme başarısız.'));
    };
  });
}

export async function getMeta(): Promise<StorageMeta> {
  if (!LOCAL_STORAGE_ENABLED) return { lastBackupAt: null };
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(META_STORE, 'readonly');
    const req = tx.objectStore(META_STORE).get('meta');
    req.onsuccess = () => {
      db.close();
      const v = req.result as StorageMeta | undefined;
      resolve(v ?? { lastBackupAt: null });
    };
    req.onerror = () => {
      db.close();
      reject(new Error('Meta okunamadı.'));
    };
  });
}

export async function setLastBackupNow(): Promise<void> {
  if (!LOCAL_STORAGE_ENABLED) notEnabled();
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(META_STORE, 'readwrite');
    tx.objectStore(META_STORE).put(
      { lastBackupAt: Date.now() } satisfies StorageMeta,
      'meta',
    );
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => {
      db.close();
      reject(new Error('Meta yazılamadı.'));
    };
  });
}

/** Son yedekten BACKUP_REMIND_DAYS geçtiyse true. */
export async function shouldRemindBackup(): Promise<boolean> {
  if (!LOCAL_STORAGE_ENABLED) return false;
  const meta = await getMeta();
  if (!meta.lastBackupAt) return true;
  const days =
    (Date.now() - meta.lastBackupAt) / (1000 * 60 * 60 * 24);
  return days >= BACKUP_REMIND_DAYS;
}

/**
 * Yerel saklama UI panelini bağlar (açıksa).
 * Dışa aktarma callback'i proje tarafında verilir (Excel yazımı).
 */
export function mountStoragePanel(
  container: HTMLElement,
  onExport: () => Promise<void>,
  lang: Lang = 'tr',
): void {
  if (!LOCAL_STORAGE_ENABLED) {
    container.hidden = true;
    return;
  }

  container.hidden = false;
  // textContent ile kur — innerHTML yok
  container.replaceChildren();

  const note = document.createElement('p');
  note.className = 'storage-note';
  note.textContent = t(lang, 'storageNote');

  const remind = document.createElement('p');
  remind.className = 'storage-remind';
  remind.hidden = true;
  remind.textContent = t(lang, 'storageRemind');

  const actions = document.createElement('div');
  actions.className = 'storage-actions';

  const btnExport = document.createElement('button');
  btnExport.type = 'button';
  btnExport.textContent = t(lang, 'storageExport');
  btnExport.addEventListener('click', () => {
    void (async () => {
      await onExport();
      await setLastBackupNow();
      remind.hidden = true;
    })();
  });

  const btnClear = document.createElement('button');
  btnClear.type = 'button';
  btnClear.className = 'danger';
  btnClear.textContent = t(lang, 'storageClear');
  btnClear.addEventListener('click', () => {
    const ok = window.confirm(t(lang, 'storageConfirm'));
    if (!ok) return;
    void clearAllData().then(() => {
      remind.hidden = false;
    });
  });

  actions.append(btnExport, btnClear);
  container.append(note, remind, actions);

  void requestPersistentStorage();
  void shouldRemindBackup().then((need) => {
    remind.hidden = !need;
  });
}
