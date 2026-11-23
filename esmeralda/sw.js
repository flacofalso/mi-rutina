// Service worker de la variante "esmeralda": reutiliza el de la raíz.
self.VARIANTE = 'esmeralda';
self.BASE = '../';
self.EXTRA = [
  './',
  'index.html',
  'manifest.webmanifest',
  'tema.css',
  'icons/icon.svg',
  'icons/icon-192.png',
  'icons/icon-512.png',
];
importScripts('../sw.js');
