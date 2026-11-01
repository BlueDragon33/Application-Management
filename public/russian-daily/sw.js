/* Russian Daily scoped offline cache; no cross-application interception. */
const CACHE = "russian-daily-candidate-0.3.0";
const ASSETS = ["./index.html", "./manifest.webmanifest", "./icon.svg"];
self.addEventListener("install", event => { event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(ASSETS))); self.skipWaiting(); });
self.addEventListener("activate", event => { event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k.startsWith("russian-daily-") && k !== CACHE).map(k => caches.delete(k))))); self.clients.claim(); });
self.addEventListener("fetch", event => { if(event.request.method !== "GET" || new URL(event.request.url).origin !== self.location.origin) return; const path = new URL(event.request.url).pathname; if(!path.includes("/russian-daily/"))return; event.respondWith(caches.match(event.request).then(hit => hit || fetch(event.request))); });
