// Almacenamiento local (IndexedDB). Todo queda solo en este dispositivo.
// Cada variante de la app (por ejemplo, /esmeralda/) guarda sus datos por separado.
const DB_NAME = 'mi-rutina' + (globalThis.APP?.id ? '-' + globalThis.APP.id : '');
const VERSION = 1;
let dbPromise;

function abrir() {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains('kv')) db.createObjectStore('kv');
        if (!db.objectStoreNames.contains('sesiones')) db.createObjectStore('sesiones', { keyPath: 'id' });
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }
  return dbPromise;
}

async function tx(store, mode, fn) {
  const db = await abrir();
  return new Promise((resolve, reject) => {
    const t = db.transaction(store, mode);
    const req = fn(t.objectStore(store));
    t.oncomplete = () => resolve(req ? req.result : undefined);
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error);
  });
}

export const kv = {
  get: (k) => tx('kv', 'readonly', (s) => s.get(k)),
  set: (k, v) => tx('kv', 'readwrite', (s) => s.put(v, k)),
  del: (k) => tx('kv', 'readwrite', (s) => s.delete(k)),
  keys: () => tx('kv', 'readonly', (s) => s.getAllKeys()),
  clear: () => tx('kv', 'readwrite', (s) => s.clear()),
};

export const sesionesDB = {
  todas: () => tx('sesiones', 'readonly', (s) => s.getAll()),
  get: (id) => tx('sesiones', 'readonly', (s) => s.get(id)),
  put: (v) => tx('sesiones', 'readwrite', (s) => s.put(v)),
  del: (id) => tx('sesiones', 'readwrite', (s) => s.delete(id)),
  clear: () => tx('sesiones', 'readwrite', (s) => s.clear()),
};

export async function pedirAlmacenamientoPersistente() {
  try {
    if (navigator.storage?.persist && !(await navigator.storage.persisted())) await navigator.storage.persist();
  } catch { /* opcional */ }
}
