// Service worker Biltov : l'espace artisan reste utilisable hors connexion sur chantier.
// Pages : toujours le réseau d'abord (sans cache HTTP) pour afficher la dernière version publiée ;
// le cache ne sert qu'en secours, quand il n'y a pas de connexion.
// Fichiers de /_next/static/ (nom unique par version, jamais modifiés) : servis directement depuis
// le cache, sans attendre le réseau. C'est ce qui rend les ouvertures suivantes rapides sur téléphone.
const CACHE = "biltov-v3";
const scope = self.registration.scope;

self.addEventListener("install", () => self.skipWaiting());

self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  const url = new URL(req.url);
  if (req.method !== "GET" || url.origin !== location.origin) return;
  if (url.pathname.includes("/_next/static/")) {
    e.respondWith(
      caches.match(req).then(
        (hit) =>
          hit ||
          fetch(req).then((res) => {
            if (res.ok) {
              const copy = res.clone();
              caches.open(CACHE).then((c) => c.put(req, copy));
            }
            return res;
          }),
      ),
    );
    return;
  }
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
