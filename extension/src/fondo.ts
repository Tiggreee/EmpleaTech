/**
 * Service worker de la extensión: el único que habla con tu instalación de EmpleaTech. Las páginas de los ATS nunca
 * ven tu perfil completo; solo reciben lo que la extensión escribe en sus campos.
 */
import { baseDeLaApp, tokenDeLaApp } from "./config";

async function pedir(ruta: string, init?: RequestInit): Promise<unknown> {
  const token = await tokenDeLaApp();
  const res = await fetch(`${await baseDeLaApp()}${ruta}`, {
    ...init,
    headers: { "Content-Type": "application/json", "x-empleatech": "extension", ...(token ? { Authorization: `Bearer ${token}` } : {}), ...init?.headers },
  });
  const body = (await res.json().catch(() => null)) as { error?: string } | null;
  if (!res.ok) throw new Error(body?.error ?? `EmpleaTech respondió ${res.status}`);
  return body;
}

type Mensaje = { tipo: "datos"; url: string } | { tipo: "evento"; cuerpo: Record<string, unknown> } | { tipo: "conectar"; token?: string };

/** Páginas desde las que se acepta la conexión de un clic: tu EmpleaTech en internet o en tu computadora. */
const APPS = /^(https:\/\/empleatech\.site|http:\/\/(localhost|127\.0\.0\.1)(:\d{1,5})?)$/;

chrome.runtime.onMessage.addListener((msg: Mensaje, remitente, responder) => {
  // Solo nuestros propios scripts de contenido; nunca otra extensión.
  if (remitente.id !== chrome.runtime.id) return false;
  if (msg.tipo === "conectar") {
    // La dirección sale de la página que pidió conectar (lo dice Chrome, no la página): nadie puede apuntarla a otro lado.
    const base = remitente.origin ?? (remitente.url ? new URL(remitente.url).origin : "");
    if (!APPS.test(base)) {
      responder({ ok: false, error: "Esa página no es tu EmpleaTech." });
      return false;
    }
    void chrome.storage.local.set({ base, token: msg.token?.trim() ?? "" }).then(() => responder({ ok: true, base }));
    return true;
  }
  const tarea = msg.tipo === "datos" ? pedir(`/api/autollenado?url=${encodeURIComponent(msg.url)}`) : pedir("/api/autollenado", { method: "POST", body: JSON.stringify(msg.cuerpo) });
  tarea
    .then((datos) => responder({ ok: true, datos }))
    .catch((e: unknown) => {
      const mensaje = e instanceof Error ? e.message : "Error desconocido";
      responder({ ok: false, error: /Failed to fetch|NetworkError/i.test(mensaje) ? "No encontramos EmpleaTech. ¿Está abierta la app en tu computadora?" : mensaje });
    });
  return true; // respuesta asíncrona
});
