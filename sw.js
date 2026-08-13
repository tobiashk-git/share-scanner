// Service worker for Share Scanner PWA.
// Strategy:
//   - App shell (html/manifest/icons): cache-first, so it opens instantly and
//     works fully offline.
//   - results.json: network-first with cache fallback, so you get fresh data
//     when online but the last successful scan still shows when offline.
// Bump CACHE_VERSION whenever the app shell changes to retire old caches.

const CACHE_VERSION = "scanner-v3";
const SHELL = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./icon-192.png",
  "./icon-512.png",
  "./apple-touch-icon.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) => cache.addAll(SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  const isData = url.pathname.endsWith("results.json");

  if (isData) {
    // Network-first: freshest scan wins; fall back to last cached copy offline.
    event.respondWith(
      fetch(request)
        .then((resp) => {
          const copy = resp.clone();
          caches.open(CACHE_VERSION).then((cache) => cache.put(request, copy));
          return resp;
        })
        .catch(() => caches.match(request))
    );
    return;
  }

  // App shell: cache-first, then network, and cache new shell files as seen.
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request).then((resp) => {
        const copy = resp.clone();
        caches.open(CACHE_VERSION).then((cache) => cache.put(request, copy));
        return resp;
      });
    })
  );
});
