/* Service worker de EmpleaTech: deja la app usable sin conexión. No intercepta nada fuera de este origen. */
const VERSION = "empleatech-v1";
const PAGINAS = ["/", "/panel", "/analizar", "/cv", "/postulaciones", "/inteligencia"];
const MAX_ENTRADAS = 250;

const ES_ESTATICO = (url) => url.pathname.startsWith("/_next/static/");

function activosDe(texto) {
  const hallados = new Set();
  for (const m of texto.matchAll(/\/_next\/static\/[^"'\\\s)?]+\.(?:js|css|woff2?|mjs)/g)) hallados.add(m[0]);
  return [...hallados];
}

async function guardar(cache, url) {
  try {
    const res = await fetch(url, { cache: "reload" });
    if (res.ok) {
      await cache.put(url, res.clone());
      return res;
    }
  } catch {
  }
  return null;
}

self.addEventListener("install", (evento) => {
  evento.waitUntil(
    (async () => {
      const cache = await caches.open(VERSION);
      const activos = new Set();
      await Promise.all(
        PAGINAS.map(async (ruta) => {
          const res = await guardar(cache, ruta);
          if (res) for (const a of activosDe(await res.text())) activos.add(a);
        }),
      );
      const css = [];
      await Promise.all(
        [...activos].map(async (a) => {
          const res = await guardar(cache, a);
          if (res && a.endsWith(".css")) css.push(await res.text());
        }),
      );
      const fuentes = new Set(css.flatMap(activosDe).filter((a) => !activos.has(a)));
      await Promise.all([...fuentes].map((f) => guardar(cache, f)));
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener("activate", (evento) => {
  evento.waitUntil(
    (async () => {
      for (const k of await caches.keys()) if (k.startsWith("empleatech-") && k !== VERSION) await caches.delete(k);
      await self.clients.claim();
    })(),
  );
});

async function recortar(cache) {
  const claves = await cache.keys();
  for (const k of claves.slice(0, Math.max(0, claves.length - MAX_ENTRADAS))) await cache.delete(k);
}

self.addEventListener("fetch", (evento) => {
  const req = evento.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  if (ES_ESTATICO(url)) {
    evento.respondWith(
      (async () => {
        const cache = await caches.open(VERSION);
        const guardado = await cache.match(req);
        if (guardado) return guardado;
        const res = await fetch(req);
        if (res.ok) {
          await cache.put(req, res.clone());
          await recortar(cache);
        }
        return res;
      })(),
    );
    return;
  }

  evento.respondWith(
    (async () => {
      const cache = await caches.open(VERSION);
      try {
        const res = await fetch(req);
        if (res.ok && (req.mode === "navigate" || url.pathname === "/manifest.webmanifest")) await cache.put(req, res.clone());
        return res;
      } catch (error) {
        const guardado = (await cache.match(req)) ?? (await cache.match(url.pathname)) ?? (req.mode === "navigate" ? await cache.match("/panel") : undefined);
        if (guardado) return guardado;
        throw error;
      }
    })(),
  );
});

