// Paso a Paso - service worker
// - La interfaz se guarda para abrir rapido (y sin internet una vez visitada).
// - MediaPipe y el modelo (archivos grandes) se guardan la primera vez que se usan.
const VERSION = "pasoapaso-v2";
const BASICOS = [
  "./", "index.html", "css/estilos.css", "js/app.js", "js/analisis.js", "js/poses.js",
  "img/logo.svg", "datos/referencias.json", "manifest.webmanifest",
  "icons/icon-192.png", "icons/icon-512.png", "icons/apple-touch-icon.png",
];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(BASICOS)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((ks) => Promise.all(ks.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

async function primeroCache(req) {
  const c = await caches.open(VERSION);
  const hit = await c.match(req);
  if (hit) return hit;
  const res = await fetch(req);
  if (res && (res.ok || res.type === "opaque")) c.put(req, res.clone());
  return res;
}

async function primeroRed(req) {
  const c = await caches.open(VERSION);
  try {
    const res = await fetch(req);
    if (res && res.ok) c.put(req, res.clone());
    return res;
  } catch (err) {
    const hit = await c.match(req, { ignoreSearch: true });
    if (hit) return hit;
    throw err;
  }
}

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) {
    if (/fonts\.(googleapis|gstatic)\.com$/.test(url.hostname)) e.respondWith(primeroCache(req));
    return;
  }
  if (req.headers.has("range") || url.pathname.includes("/videos/")) return; // lo maneja el navegador
  if (/\/(lib|modelos)\//.test(url.pathname)) { e.respondWith(primeroCache(req)); return; }
  e.respondWith(primeroRed(req));
});
