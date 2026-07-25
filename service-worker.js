// United FC service worker — handles automatic updates so players never
// need to manually reinstall or find a new link.
//
// Strategy:
// - HTML (this app itself): Network First — always tries to fetch the
//   latest version first, falls back to cache only if offline.
// - Static assets (icons, manifest): Cache First — fast, rarely change.
// - Never touches Supabase or any cross-origin request — data is always live.
//
// Update safety: this worker takes over immediately (skipWaiting +
// clients.claim), but it does NOT force a page reload — the app itself
// listens for the new worker taking control and shows a small
// "Updated successfully" notice with a manual refresh button, so nobody
// loses in-progress form data to a surprise reload.

const CACHE_VERSION = 'v2'; // bump this string whenever you deploy a real update
const CACHE_NAME = 'united-fc-shell-' + CACHE_VERSION;

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
  self.skipWaiting(); // activate the new worker immediately, don't wait for old tabs to close
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((names) =>
      Promise.all(names.filter((n) => n !== CACHE_NAME).map((n) => caches.delete(n)))
    )
  );
  self.clients.claim(); // take control of any already-open tabs right away
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Never touch Supabase (or any cross-origin) requests — data is always live, never cached.
  if (url.origin !== self.location.origin) {
    return;
  }

  const isNavigationOrHtml = event.request.mode === 'navigate' || url.pathname.endsWith('.html') || url.pathname.endsWith('/');

  if (isNavigationOrHtml) {
    // Network First: always try to get the freshest app code.
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          return response;
        })
        .catch(() => caches.match(event.request))
    );
  } else {
    // Cache First for static assets (icons, manifest) — fast, rarely change.
    event.respondWith(
      caches.match(event.request).then((cached) => cached || fetch(event.request))
    );
  }
});
