/* BlackBox service worker: network-first app shell (never serves stale code when online), cached posters, offline fallback. */
const VERSION = "bb-v1";
const SHELL = `${VERSION}-shell`, IMAGES = `${VERSION}-img`;
const PRECACHE = ["/", "/browse.html", "/preview.html", "/watch.html", "/styles.css", "/detail-pages.css", "/core.js", "/app.js", "/browse.js", "/detail-pages.js", "/manifest.webmanifest", "/icons/icon-192.png"];
const BROWSE_ROUTES = ["/movies", "/series", "/trending", "/my-list", "/search"];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(SHELL).then(c => Promise.allSettled(PRECACHE.map(u => c.add(u)))).then(() => self.skipWaiting()));
});
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => !k.startsWith(VERSION)).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  // Never touch the video player, ads, or API: always live.
  if (url.hostname.endsWith("vaplayer.ru") || url.pathname.startsWith("/api/")) return;
  // Posters: cache-first with background refresh.
  if (url.hostname === "image.tmdb.org") {
    e.respondWith(caches.open(IMAGES).then(async cache => {
      const hit = await cache.match(req);
      const net = fetch(req).then(r => { if (r.ok || r.type === "opaque") cache.put(req, r.clone()); return r; }).catch(() => hit);
      return hit || net;
    }));
    return;
  }
  if (url.origin !== location.origin) return;
  // App shell: network first, fall back to cache.
  e.respondWith((async () => {
    try {
      const res = await fetch(req);
      if (res.ok) { const copy = res.clone(); caches.open(SHELL).then(c => c.put(req, copy)); }
      return res;
    } catch {
      const cache = await caches.open(SHELL);
      let hit = await cache.match(req, { ignoreSearch: true });
      if (!hit && BROWSE_ROUTES.includes(url.pathname)) hit = await cache.match("/browse.html");
      if (!hit && req.mode === "navigate") hit = await cache.match("/");
      return hit || new Response("You're offline.", { status: 503, headers: { "Content-Type": "text/plain" } });
    }
  })());
});
