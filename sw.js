// Service worker: permite usar la app sin conexión (por ejemplo, en el gimnasio).
// Al publicar cambios, sube VERSION para que los teléfonos descarguen la nueva versión.
// Una variante (por ejemplo /esmeralda/) define self.VARIANTE, self.BASE y self.EXTRA
// y luego importa este archivo.
const VERSION = 'v4';
const VARIANTE = self.VARIANTE || 'base';
const BASE = self.BASE || '';
const PREFIJO = 'mi-rutina-' + VARIANTE + '-';
const CACHE = PREFIJO + VERSION;
const COMUNES = [
  'css/styles.css',
  'js/app.js',
  'js/db.js',
  'js/data.js',
  'js/ui.js',
  'js/timer.js',
  'js/resumen.js',
  'js/xlsx-parser.js',
  'js/vistas/hoy.js',
  'js/vistas/entrenar.js',
  'js/vistas/comidas.js',
  'js/vistas/historial.js',
  'js/vistas/ajustes.js',
];
const PROPIOS = self.EXTRA || [
  './',
  'index.html',
  'manifest.webmanifest',
  'icons/icon.svg',
  'icons/icon-192.png',
  'icons/icon-512.png',
];
const ARCHIVOS = [
  ...PROPIOS,
  ...COMUNES.map((f) => BASE + f),
  'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ARCHIVOS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE && (k.startsWith(PREFIJO) || (VARIANTE === 'base' && /^mi-rutina-v\d+$/.test(k)))).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

// Red primero (para recibir actualizaciones) y caché si no hay conexión
// o si la red tarda más de 4 s (señal débil en el gimnasio).
const conTiempo = (p, ms) => Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), ms))]);

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    conTiempo(fetch(e.request), 4000)
      .then((r) => {
        if (r.ok && (r.type === 'basic' || r.type === 'cors')) {
          const copia = r.clone();
          caches.open(CACHE).then((c) => c.put(e.request, copia));
        }
        return r;
      })
      .catch(() => caches.match(e.request, { ignoreSearch: true }).then((r) => r || caches.match('index.html'))),
  );
});
