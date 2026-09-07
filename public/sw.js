const CACHE_NAME = "hoa-nhap-nga-webapp-v1";
const SAFE_ASSETS = ["/manifest.webmanifest", "/ru-medcheck.webmanifest", "/favicon.svg", "/icon-192.png", "/icon-512.png", "/offline.html"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(SAFE_ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))).then(() => self.clients.claim()));
});

async function networkFirst(request, fallback) {
  const cache = await caches.open(CACHE_NAME);
  try {
    const response = await fetch(request);
    if (response.ok) await cache.put(request, response.clone());
    return response;
  } catch {
    return await cache.match(request) || await cache.match(fallback);
  }
}

async function cacheFirst(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok) await cache.put(request, response.clone());
  return response;
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (url.pathname.startsWith("/api/") || url.pathname.startsWith("/signin-") || url.pathname.startsWith("/signout-")) return;

  if (request.mode === "navigate") {
    if (url.pathname === "/" || url.pathname === "/ru-medcheck" || url.pathname.startsWith("/ru-medcheck/")) {
      event.respondWith(networkFirst(request, "/offline.html"));
    } else {
      event.respondWith(fetch(request).catch(() => caches.match("/offline.html")));
    }
    return;
  }

  const staticAsset = url.pathname.startsWith("/_next/") || url.pathname.startsWith("/assets/") || /\.(?:js|css|woff2?|png|svg|ico)$/.test(url.pathname);
  if (SAFE_ASSETS.includes(url.pathname) || staticAsset) event.respondWith(cacheFirst(request));
});
