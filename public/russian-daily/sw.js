/* Russian Daily candidate service worker, isolated to this subpath. */
const CACHE = "russian-daily-candidate-0.3.3";
const ASSETS = ["./", "./manifest.webmanifest", "./icon.svg"];
self.addEventListener("install", event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(ASSETS)));
  self.skipWaiting();
});
self.addEventListener("activate", event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith("russian-daily-candidate-") && key !== CACHE).map(key => caches.delete(key)))));
  self.clients.claim();
});
self.addEventListener("fetch", event => {
  if (event.request.method !== "GET") return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin || !url.pathname.startsWith("/russian-daily/")) return;
  event.respondWith(fetch(event.request).then(response => {
    // Never persist a redirected login page after the session expires.
    const finalUrl = new URL(response.url);
    if (response.ok && !response.redirected && finalUrl.origin === self.location.origin
        && finalUrl.pathname.startsWith("/russian-daily/")) {
      const copy = response.clone();
      event.waitUntil(caches.open(CACHE).then(cache => cache.put(event.request, copy)));
    }
    return response;
  }).catch(() => caches.match(event.request).then(response => response || Response.error())));
});
