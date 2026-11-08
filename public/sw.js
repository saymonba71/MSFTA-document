/* ISOE Studio service worker: offline shell + lazy WASM/model cache.
   Build writes /asset-manifest.json (hashed files); dev falls back to network-first. */
const VERSION = "isoe-sw-v4";
const SHELL = ["/", "/index.html", "/csp.js", "/manifest.webmanifest", "/app-icon.svg", "/icons/app-192.png", "/icons/app-512.png", "/icons/app-maskable-512.png"];
const STATIC = /\.(js|mjs|css|woff2?|ttf|wasm|png|jpg|svg|json|traineddata\.gz)$/;

self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(VERSION);
    await cache.addAll(SHELL).catch(() => {});
    try {
      const res = await fetch("/asset-manifest.json", { cache: "no-store" });
      if (res.ok) { const list = await res.json(); await cache.addAll(list).catch(() => {}); }
    } catch { /* dev: no manifest */ }
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => k !== VERSION && (k.startsWith("isoe-") || k.startsWith("seal-studio-"))).map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});

async function cacheFirst(request, cache) {
  const hit = await cache.match(request);
  if (hit) return hit;
  const res = await fetch(request);
  if (res.ok && new URL(request.url).origin === self.location.origin) await cache.put(request, res.clone());
  return res;
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return; // never proxy cross-origin (AI calls go direct, consented)
  if (request.method === "POST" && url.pathname === "/share-target") {
    event.respondWith((async () => {
      const form = await request.formData();
      const file = form.get("file");
      const cache = await caches.open(VERSION + "-share");
      if (file && typeof file === "object" && "arrayBuffer" in file) {
        await cache.put("/__shared__", new Response(await file.arrayBuffer(), { headers: { "content-type": file.type || "application/octet-stream", "x-name": encodeURIComponent(file.name || "shared") } }));
      }
      return Response.redirect("/#/studio", 303);
    })());
    return;
  }
  if (request.method !== "GET") return;
  if (request.mode === "navigate") {
    event.respondWith((async () => {
      try { const res = await fetch(request); if (res.ok) { const c = await caches.open(VERSION); await c.put("/", res.clone()); } return res; }
      catch { return (await caches.match("/")) || Response.error(); }
    })());
    return;
  }
  if (SHELL.includes(url.pathname) || STATIC.test(url.pathname) || url.pathname.startsWith("/assets/") || url.pathname.startsWith("/fonts/") || url.pathname.startsWith("/ocr/") || url.pathname.startsWith("/bg-assets/")) {
    event.respondWith((async () => { const cache = await caches.open(VERSION); try { return await cacheFirst(request, cache); } catch { return (await cache.match(request)) || Response.error(); } })());
  }
});

self.addEventListener("message", (event) => {
  if (event.data === "skip-waiting") self.skipWaiting();
  if (event.data === "clear-caches") event.waitUntil(caches.keys().then((ks) => Promise.all(ks.map((k) => caches.delete(k)))));
});
