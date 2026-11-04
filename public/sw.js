// Service worker de la agenda.
// - Con señal: todo va al servidor, como siempre (no se guardan páginas con datos de alumnos).
// - Sin señal (o si el servidor no contesta en 10 s): abre la versión sin conexión (offline.html + sin-conexion.js),
//   que usa lo que el celu guardó la última vez y deja tomar asistencia y cargar notas.
const CACHE = "agenda-v3";
const FIJOS = ["/offline.html", "/sin-conexion.js", "/icons/icon-192.png"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FIJOS.map((u) => new Request(u, { cache: "reload" })))));
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

function conTiempo(promesa, ms) {
  return new Promise((ok, mal) => {
    const t = setTimeout(() => mal(new Error("tardó demasiado")), ms);
    promesa.then((r) => { clearTimeout(t); ok(r); }, (e) => { clearTimeout(t); mal(e); });
  });
}

self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  if (url.origin !== location.origin || e.request.method !== "GET") return;

  if (e.request.mode === "navigate") {
    e.respondWith(conTiempo(fetch(e.request), 10000).catch(() => caches.match("/offline.html")));
    return;
  }
  // Los archivos de la versión sin conexión: los del servidor si hay señal (y se actualiza la copia), si no la copia
  if (FIJOS.includes(url.pathname)) {
    e.respondWith(
      fetch(e.request)
        .then((r) => {
          if (r.ok) caches.open(CACHE).then((c) => c.put(url.pathname, r.clone()));
          return r;
        })
        .catch(() => caches.match(url.pathname)),
    );
  }
});
