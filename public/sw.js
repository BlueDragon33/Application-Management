const CACHE_NAME = "application-management-webapp-v2";
// Preserve only the admitted, versioned public audio cache; never cache authenticated pages.
const RETAINED_PUBLIC_AUDIO_CACHE = "russian-time-trainer-chatterbox-15117885099";
const SAFE_ASSETS = ["/manifest.webmanifest", "/favicon.svg", "/icon-192.png", "/icon-512.png", "/offline.html"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(SAFE_ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME && key !== RETAINED_PUBLIC_AUDIO_CACHE).map((key) => caches.delete(key)))).then(() => self.clients.claim()));
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin || url.pathname.startsWith("/api/") || url.pathname.startsWith("/signin-") || url.pathname.startsWith("/signout-")) return;
  if (request.mode === "navigate") {
    event.respondWith(fetch(request).catch(() => caches.match("/offline.html")));
    return;
  }
  if (SAFE_ASSETS.includes(url.pathname)) event.respondWith(caches.match(request).then((cached) => cached || fetch(request)));
});
