// Service worker Biltov : l'espace artisan reste utilisable hors connexion sur chantier.
// Toujours le réseau d'abord (sans cache HTTP) pour afficher la dernière version publiée ;
// le cache ne sert qu'en secours, quand il n'y a pas de connexion.
const CACHE = "biltov-v2";
const scope = self.registration.scope;

self.addEventListener("install", () => self.skipWaiting());

self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  const url = new URL(req.url);
  if (req.method !== "GET" || url.origin !== location.origin) return;
  e.respondWith(
    fetch(req, { cache: req.mode === "navigate" ? "no-cache" : "default" })
      .then((res) => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy));
        }
        return res;
      })
      .catch(() => caches.match(req).then((hit) => hit || (req.mode === "navigate" ? caches.match(`${scope}tableau-de-bord/`) : undefined)).then((r) => r || Response.error())),
  );
});
