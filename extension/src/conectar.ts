/**
 * Solo en las páginas de tu EmpleaTech: avisa que la extensión está instalada y recibe la conexión de un clic desde
 * «Autollenado» (dirección y token), para que no tengas que copiar nada a las opciones.
 */
const VERSION = chrome.runtime.getManifest().version;
const APP = "empleatech-app";
const EXTENSION = "empleatech-extension";

// La página puede cargar antes o después que este script: se avisa al llegar y se contesta cuando la página pregunta.
const avisar = () => window.postMessage({ fuente: EXTENSION, tipo: "lista", version: VERSION }, location.origin);
avisar();

window.addEventListener("message", (e: MessageEvent) => {
  // Solo la propia página (no iframes ni otras ventanas) puede hablar con la extensión.
  if (e.source !== window || e.origin !== location.origin) return;
  const d = e.data as { fuente?: unknown; tipo?: unknown; token?: unknown } | null;
  if (d?.fuente !== APP) return;
  if (d.tipo === "hola") return avisar();
  if (d.tipo !== "conectar") return;
  const token = typeof d.token === "string" ? d.token : undefined;
  chrome.runtime.sendMessage({ tipo: "conectar", token }, (r: { ok: boolean; base?: string; error?: string } | undefined) => {
    const error = chrome.runtime.lastError ? "La extensión se actualizó: recarga esta página." : r?.ok ? undefined : (r?.error ?? "La extensión no respondió.");
    window.postMessage({ fuente: EXTENSION, tipo: "conectada", ok: !error, base: r?.base, error }, location.origin);
  });
});
