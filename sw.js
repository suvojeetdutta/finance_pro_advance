const CACHE_NAME = 'financepro-v3';
const ASSETS = [
  './',
  './index.html',
  './styles.css',
  './app.js',
  './sync.js',
  './manifest.json',
  './libs/chart.min.js',
  './libs/inter.css',
  './libs/inter-latin.woff2',
  './libs/fontawesome/all.min.css',
  './libs/fontawesome/webfonts/fa-solid-900.woff2',
  './libs/fontawesome/webfonts/fa-regular-400.woff2',
  './libs/fontawesome/webfonts/fa-brands-400.woff2',
  './icons/icon-192.png',
  './icons/icon-512.png'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))));
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  e.respondWith(
    fetch(e.request).catch(() => caches.match(e.request))
  );
});
