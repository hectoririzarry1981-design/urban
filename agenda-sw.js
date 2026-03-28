// agenda-sw.js — Service Worker para Agenda Diaria PWA

const CACHE_NAME = 'agenda-v1';
const ASSETS = [
  './agenda.html',
  './agenda-styles.css',
  './agenda-config.js',
  './agenda-app.js',
  './agenda-ui.js',
  './agenda-manifest.webmanifest'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request).then(cached => cached || fetch(event.request))
  );
});
