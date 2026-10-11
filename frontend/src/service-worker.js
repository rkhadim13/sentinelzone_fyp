/* eslint-disable no-restricted-globals */

// This line is required by Create React App's build process (Workbox)
// It tells the build tool where to inject the list of files to cache
const manifest = self.__WB_MANIFEST;

const CACHE_NAME = 'sentinelzone-cache-v1';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((response) => {
      return response || fetch(event.request);
    })
  );
});