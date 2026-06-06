const CACHE_NAME = 'reuni-al-fatah-v7';
const STATIC_ASSETS = [
  './',
  './countdown.html',
  './Rundown.html',
  './pendaftaran.html',
  './pembayaran.html',
  './cek-status.html',
  './login.html',
  './daftar.html',
  './surat-undangan.html',
  './404.html',
  './css/all.min.css',
  './css/custom-theme.css',
  './js/lib/tailwindcss.js',
  './js/lib/qrcode.min.js',
  './js/lib/jspdf.umd.min.js',
  './js/lib/jspdf.plugin.autotable.min.js',
  './js/transitions.js',
  './js/nav-component.js',
  './js/address-extractor.js',
  './js/capacitor-plugins.js',
  './js/services/pdf-service.js',
  './capacitor.js',
  './img/logo.png',
  './img/icon-192.png',
  './img/icon-512.png',
  './img/apple-touch-icon.png',
  './webfonts/fa-solid-900.woff2',
  './webfonts/fa-solid-900.ttf',
  './webfonts/fa-regular-400.woff2',
  './webfonts/fa-regular-400.ttf',
  './webfonts/fa-brands-400.woff2',
  './webfonts/fa-brands-400.ttf'
];

// Install Service Worker
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[Service Worker] Pre-caching static assets');
      return cache.addAll(STATIC_ASSETS);
    }).then(() => {
      return self.skipWaiting();
    })
  );
});

// Activate Service Worker
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('[Service Worker] Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      return self.clients.claim();
    })
  );
});

// Fetch Interceptor
self.addEventListener('fetch', (event) => {
  const requestUrl = new URL(event.request.url);

  // Skip caching for Firebase write calls, Cloudinary uploads, region APIs, or non-GET requests
  if (
    event.request.method !== 'GET' ||
    requestUrl.origin.includes('firestore') ||
    requestUrl.origin.includes('cloudinary') ||
    requestUrl.origin.includes('emsifa') ||
    requestUrl.origin.includes('allorigins') ||
    requestUrl.origin.includes('corsproxy')
  ) {
    return;
  }

  // HTML Page requests: Network-First strategy
  if (event.request.mode === 'navigate' || requestUrl.pathname.endsWith('.html')) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          // Put clone in cache
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseClone);
          });
          return response;
        })
        .catch(() => {
          // If offline, serve from cache
          return caches.match(event.request).then((cachedResponse) => {
            if (cachedResponse) {
              return cachedResponse;
            }
            // If completely offline and not in cache, fallback to 404.html
            return caches.match('./404.html');
          });
        })
    );
    return;
  }

  // Static Assets (CSS, JS, Fonts, Images): Cache-First strategy
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }
      return fetch(event.request).then((response) => {
        if (!response || response.status !== 200 || (response.type !== 'basic' && response.type !== 'cors')) {
          return response;
        }
        const responseClone = response.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, responseClone);
        });
        return response;
      });
    })
  );
});

