const CACHE_NAME = "seal-studio-shell-v2";
const SHELL = ["/", "/manifest.webmanifest", "/app-icon.svg", "/icons/app-192.png", "/icons/app-512.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((key) => key.startsWith("seal-studio-shell-") && key !== CACHE_NAME).map((key) => caches.delete(key)))).then(() => self.clients.claim()));
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET" || new URL(request.url).origin !== self.location.origin) return;
  if (request.mode === "navigate") {
    const network = fetch(request);
    event.waitUntil(network.then((response) => {
      if (!response.ok) return;
      const copy = response.clone();
      return caches.open(CACHE_NAME).then((cache) => cache.put("/", copy));
    }).catch(() => {}));
    event.respondWith(network.catch(async () => (await caches.match("/")) || Response.error()));
  } else if (SHELL.some((path) => new URL(path, self.location.origin).pathname === new URL(request.url).pathname)) {
    event.respondWith(caches.match(request).then((cached) => cached || fetch(request)));
  }
});