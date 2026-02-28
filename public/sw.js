// Service Worker for PWA functionality
const CACHE_NAME = 'loan-app-v1';
const urlsToCache = [
    '/',
    '/index.html',
    '/index.css',
    '/firetruck.png',
    '/manifest.json'
];

const shouldBypassCache = (request) => {
    const url = new URL(request.url);
    return (
        request.method !== 'GET' ||
        url.pathname.startsWith('/supabase-auth/') ||
        url.pathname.startsWith('/supabase-rest/') ||
        url.pathname.startsWith('/.netlify/functions/') ||
        url.hostname.endsWith('.supabase.co')
    );
};

// Install event - cache assets
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                console.log('Opened cache');
                return cache.addAll(urlsToCache);
            })
    );
    // Force the waiting service worker to become the active service worker
    self.skipWaiting();
});

// Fetch event - serve from cache, fallback to network
self.addEventListener('fetch', (event) => {
    if (shouldBypassCache(event.request)) {
        event.respondWith(fetch(event.request));
        return;
    }

    event.respondWith(
        caches.match(event.request)
            .then((response) => {
                // Cache hit - return response
                if (response) {
                    return response;
                }
                return fetch(event.request).then(
                    (response) => {
                        // Check if we received a valid response
                        if (!response || response.status !== 200 || response.type !== 'basic') {
                            return response;
                        }

                        // Clone the response
                        const responseToCache = response.clone();

                        caches.open(CACHE_NAME)
                            .then((cache) => {
                                cache.put(event.request, responseToCache);
                            });

                        return response;
                    }
                );
            })
    );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
    const cacheWhitelist = [CACHE_NAME];
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    if (cacheWhitelist.indexOf(cacheName) === -1) {
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
    // Claim clients immediately
    return self.clients.claim();
});
