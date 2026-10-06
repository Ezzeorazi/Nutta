// Service worker mínimo de Nutta — cache del app-shell para uso offline.
const CACHE = "nutta-v3";

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((c) => c.add("/"))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))),
      )
      .then(() => self.clients.claim()),
  );
});

// Aviso empujado por el servidor. Es lo único que llega con la app CERRADA:
// el resto del archivo corre solo cuando hay una pestaña viva.
self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    // payload no-JSON: se muestra un aviso genérico antes que nada
  }
  const title = data.title || "Nutta";
  event.waitUntil(
    self.registration.showNotification(title, {
      body: data.body || "",
      icon: "/icon.svg",
      badge: "/icon.svg",
      // Un tag por día y tipo: si llegan dos, el nuevo reemplaza al viejo en
      // vez de apilarse.
      tag: data.tag || "nutta",
      data: { url: data.url || "/" },
      // El aviso de la noche pierde sentido si se descarta solo mientras el
      // teléfono está en el bolsillo.
      requireInteraction: !!data.requireInteraction,
    }),
  );
});

// Al tocar un aviso del plan: enfoca una pestaña abierta o abre una nueva.
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if ("focus" in client) return client.focus();
      }
      return self.clients.openWindow("/");
    }),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);
  // Solo mismo origen; nunca cachear las rutas de API (datos frescos).
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/")) return;

  // La página (HTML) va primero a la red: con cache-first, cada deploy se veía
  // recién en la SEGUNDA apertura (y en el celular, con la app viva en segundo
  // plano, eso podía ser días). El cache queda solo para cuando no hay señal.
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (res && res.status === 200 && res.type === "basic") {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put("/", copy));
          }
          return res;
        })
        .catch(() => caches.match("/").then((r) => r || Response.error())),
    );
    return;
  }

  // El resto (JS/CSS con hash en el nombre, íconos): stale-while-revalidate.
  // Un archivo con hash nunca cambia, así que servirlo del cache no deja nada
  // viejo en pantalla.
  event.respondWith(
    caches.match(req).then((cached) => {
      const network = fetch(req)
        .then((res) => {
          if (res && res.status === 200 && res.type === "basic") {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(req, copy));
          }
          return res;
        })
        .catch(() => cached);
      return cached || network;
    }),
  );
});
