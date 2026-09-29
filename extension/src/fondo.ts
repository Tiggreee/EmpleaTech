/**
 * Service worker de la extensión: el único que habla con tu instalación de EmpleaTech. Las páginas de los ATS nunca
 * ven tu perfil completo; solo reciben lo que la extensión escribe en sus campos.
 */
import { baseDeLaApp } from "./config";

async function pedir(ruta: string, init?: RequestInit): Promise<unknown> {
  const res = await fetch(`${await baseDeLaApp()}${ruta}`, { ...init, headers: { "Content-Type": "application/json", "x-empleatech": "extension", ...init?.headers } });
  const body = (await res.json().catch(() => null)) as { error?: string } | null;
  if (!res.ok) throw new Error(body?.error ?? `EmpleaTech respondió ${res.status}`);
  return body;
}

type Mensaje = { tipo: "datos"; url: string } | { tipo: "evento"; cuerpo: Record<string, unknown> };

chrome.runtime.onMessage.addListener((msg: Mensaje, _remitente, responder) => {
  const tarea = msg.tipo === "datos" ? pedir(`/api/autollenado?url=${encodeURIComponent(msg.url)}`) : pedir("/api/autollenado", { method: "POST", body: JSON.stringify(msg.cuerpo) });
  tarea
    .then((datos) => responder({ ok: true, datos }))
    .catch((e: unknown) => {
      const mensaje = e instanceof Error ? e.message : "Error desconocido";
      responder({ ok: false, error: /Failed to fetch|NetworkError/i.test(mensaje) ? "No encontramos EmpleaTech. ¿Está abierta la app en tu computadora?" : mensaje });
    });
  return true; // respuesta asíncrona
});
