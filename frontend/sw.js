const CACHE_NAME = 'trackify-cache-v2';
const OFFLINE_URL = '/login.html';

const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/login',
  '/login.html',
  '/register',
  '/register.html',
  '/assets/css/style.css',
  '/assets/js/main.js',
  '/assets/images/favicon.png',
  '/assets/images/favicon.webp',
  '/assets/images/favicon-192.png',
  '/assets/images/favicon-192.webp',
  '/assets/images/favicon-512.png',
  '/assets/images/favicon-512.webp',
  '/assets/images/logo_light.webp',
  '/assets/images/logo_dark.webp',
  'https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css',
  'https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/js/bootstrap.bundle.min.js',
  'https://cdn.jsdelivr.net/npm/chart.js'
];

// Install Service Worker and cache essential assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[Service Worker] Pre-caching offline assets');
      return cache.addAll(ASSETS_TO_CACHE).catch(err => {
        console.warn('[Service Worker] Failed to pre-cache some assets:', err);
      });
    }).then(() => self.skipWaiting())
  );
});

// Activate event: clean up outdated caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            console.log('[Service Worker] Deleting old cache:', cache);
            return caches.delete(cache);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch event: Network-first for HTML pages, Cache-first for static assets
self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);

  // Skip non-GET requests and external API/auth requests to prevent issues
  if (request.method !== 'GET' || url.pathname.startsWith('/api/')) {
    return;
  }

  // Network-first strategy for HTML pages/documents (to keep dynamic views and auth guards working)
  if (request.headers.get('accept')?.includes('text/html') || url.pathname.endsWith('.html') || !url.pathname.includes('.')) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // Cache a copy of the retrieved page for offline fallback
          const responseCopy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, responseCopy));
          return response;
        })
        .catch(() => {
          // If offline, return the cached page or fallback to /login.html
          return caches.match(request).then((cachedResponse) => {
            return cachedResponse || caches.match(OFFLINE_URL);
          });
        })
    );
    return;
  }

  // Cache-first strategy for images, stylesheets, scripts, and fonts
  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      if (cachedResponse) {
        // Return from cache, and optionally fetch in the background to update cache (stale-while-revalidate style)
        fetch(request).then((networkResponse) => {
          if (networkResponse.status === 200) {
            caches.open(CACHE_NAME).then((cache) => cache.put(request, networkResponse));
          }
        }).catch(() => {/* Ignore network errors during background sync */});
        return cachedResponse;
      }

      return fetch(request).then((response) => {
        if (!response || response.status !== 200) {
          return response;
        }
        const responseCopy = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(request, responseCopy));
        return response;
      });
    })
  );
});
