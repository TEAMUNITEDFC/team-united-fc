// Minimal service worker — exists mainly so the browser considers this
// installable as a PWA. It only caches the static app shell (this HTML,
// icons, manifest) for fast/offline loading of the shell itself.
// It deliberately does NOT cache or intercept any Supabase network
// requests, so your live data is always fetched fresh, never stale.

const CACHE_NAME = 'united-fc-shell-v1';
const SHELL_FILES = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_FILES))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((names) =>
      Promise.all(names.filter((n) => n !== CACHE_NAME).map((n) => caches.delete(n)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Never touch Supabase (or any cross-origin) requests — always go straight
  // to the network so data is always live, never served from cache.
  if (url.origin !== self.location.origin) {
    return;
  }

  // For same-origin shell files: try cache first, fall back to network.
  event.respondWith(
    caches.match(event.request).then((cached) => cached || fetch(event.request))
  );
});
