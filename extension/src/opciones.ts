import { BASE_POR_DEFECTO, baseDeLaApp, tokenDeLaApp } from "./config";

const campo = document.getElementById("base") as HTMLInputElement;
const campoToken = document.getElementById("token") as HTMLInputElement;
const estado = document.getElementById("estado") as HTMLParagraphElement;

void baseDeLaApp().then((b) => (campo.value = b));
void tokenDeLaApp().then((t) => (campoToken.value = t ?? ""));

document.getElementById("guardar")?.addEventListener("click", async () => {
  let url: URL;
  try {
    url = new URL(campo.value.trim() || BASE_POR_DEFECTO);
  } catch {
    estado.textContent = "Esa dirección no es válida.";
    return;
  }
  // Fuera de tu computadora, Chrome pide permiso para hablar con esa dirección.
  if (!/^(localhost|127\.0\.0\.1)$/.test(url.hostname)) {
    const ok = await chrome.permissions.request({ origins: [`${url.origin}/*`] });
    if (!ok) {
      estado.textContent = "Sin permiso para esa dirección.";
      return;
    }
  }
  await chrome.storage.local.set({ base: url.origin, token: campoToken.value.trim() });
  estado.textContent = "Guardado.";
});
