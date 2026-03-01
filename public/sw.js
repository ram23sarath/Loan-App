// Service Worker for PWA functionality
const CACHE_NAME = 'loan-app-v2';
const urlsToCache = [
    '/',
    '/index.html',
    '/index.css',
    '/firetruck.png',
    '/ap_govt_emblem.png',
    '/ap_firetruck_truck.png',
    '/police_officer.png',
    '/manifest.json'
];

// Image extensions that get cache-first treatment
const IMAGE_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.webp', '.avif', '.gif', '.svg'];
const isImageRequest = (url) => IMAGE_EXTENSIONS.some(ext => url.pathname.endsWith(ext));

// Fetch an image with a hard timeout; resolves to null on timeout/error
const fetchWithTimeout = (request, ms) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), ms);
    return fetch(request, { signal: controller.signal })
        .then(r => { clearTimeout(timer); return r; })
        .catch(() => { clearTimeout(timer); return null; });
};

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

    const url = new URL(event.request.url);

    // Cache-first strategy for images with 5-second network timeout
    if (isImageRequest(url)) {
        event.respondWith(
            caches.match(event.request).then((cached) => {
                if (cached) return cached;

                return fetchWithTimeout(event.request.clone(), 5000).then((response) => {
                    // Opaque cross-origin responses have status 0 but are valid —
                    // cache and serve them as-is (their contents cannot be inspected).
                    if (response && response.type === 'opaque') {
                        const clone = response.clone();
                        caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
                        return response;
                    }
                    // For same-origin responses only accept HTTP 200.
                    if (!response || response.status !== 200) {
                        // Return a transparent 1x1 PNG so broken-image icons never show
                        return new Response(
                            Uint8Array.from(atob(
                                'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='
                            ), c => c.charCodeAt(0)),
                            { headers: { 'Content-Type': 'image/png' } }
                        );
                    }
                    const clone = response.clone();
                    caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
                    return response;
                });
            })
        );
        return;
    }

    // Network-first with cache fallback for everything else
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
