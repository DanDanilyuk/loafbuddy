'use strict';

// Network-first service worker for offline use in the kitchen. Online visitors
// always get the latest deploy, and every successful response refreshes the
// cache, so content changes no longer need a version bump. Bump CACHE_VERSION
// only to drop old caches (e.g. when the ASSETS list changes).
const CACHE_VERSION = 'loafbuddy-v4';
// '/index.html' is left out on purpose: the host redirects it to '/', and a
// cached redirect cannot answer a navigation.
const ASSETS = [
  '/',
  '/css/style.css',
  '/js/app.js',
  '/manifest.json'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION)
      .then((cache) => cache.addAll(ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((key) => key !== CACHE_VERSION).map((key) => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin) return;

  // Pages are cached and matched by path alone, so links with tracking params
  // (?utm_...) still open offline without piling up a copy per query string.
  const isPage = request.mode === 'navigate';
  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response.ok && !response.redirected) {
          const copy = response.clone();
          event.waitUntil(caches.open(CACHE_VERSION).then((cache) => cache.put(isPage ? url.pathname : request, copy)));
        }
        return response;
      })
      .catch(() => caches.match(request, { ignoreSearch: isPage })
        .then((cached) => cached || Response.error()))
  );
});
