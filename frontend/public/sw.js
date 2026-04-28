const CACHE_NAME = 'chitt-tracker-v1';

const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/favicon.ico',
  '/logo192.png',
  '/logo512.png'
];

// Install - cache static assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    })
  );
  self.skipWaiting();
});

// Activate - clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      );
    })
  );
  self.clients.claim();
});

// Fetch - network first, fall back to cache
self.addEventListener('fetch', (event) => {
  // Skip non-GET requests and Firebase/external calls
  if (event.request.method !== 'GET') return;
  if (event.request.url.includes('firestore.googleapis.com')) return;
  if (event.request.url.includes('googleapis.com')) return;
  if (event.request.url.includes('firebase')) return;

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Cache successful responses for app shell files
        if (response && response.status === 200) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, clone);
          });
        }
        return response;
      })
      .catch(() => {
        // Network failed - serve from cache
        return caches.match(event.request).then((cached) => {
          if (cached) return cached;
          // If it's a navigation request, return the main app
          if (event.request.mode === 'navigate') {
            return caches.match('/index.html');
          }
        });
      })
  );
});
