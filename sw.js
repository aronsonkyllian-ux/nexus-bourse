/* Équipe Nexus — service worker : coque hors ligne (cache d'abord), données en réseau d'abord. */
const V = "nexus-v4";
const SHELL = ["./", "index.html", "style.css", "app.js", "manifest.json", "icons/icon-192.png", "icons/icon-512.png"];
self.addEventListener("install", e => { e.waitUntil(caches.open(V).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== V).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", e => {
  const req = e.request; if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.pathname.endsWith("/data/nexus.json")) {           // données : réseau d'abord, cache si hors ligne
    e.respondWith(fetch(req).then(r => { const c = r.clone(); caches.open(V).then(x => x.put(req, c)); return r; })
      .catch(() => caches.match(req, { ignoreSearch: true })));
    return;
  }
  if (url.origin === location.origin || url.host.includes("fonts.g")) {   // coque : cache, mise à jour en arrière-plan
    e.respondWith(caches.match(req).then(hit => {
      const net = fetch(req).then(r => { if (r && (r.ok || r.type === "opaque")) { const c = r.clone(); caches.open(V).then(x => x.put(req, c)); } return r; })
        .catch(() => hit || (req.mode === "navigate" ? caches.match("index.html") : undefined));
      return hit || net;
    }));
  }
});
