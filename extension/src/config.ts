/** Dónde corre tu EmpleaTech. Por defecto, en internet; «Conectar» en Autollenado la cambia por la página desde la que conectas. */
export const BASE_POR_DEFECTO = "https://empleatech.site";

export async function baseDeLaApp(): Promise<string> {
  const { base } = await chrome.storage.local.get("base");
  return typeof base === "string" && base ? base.replace(/\/+$/, "") : BASE_POR_DEFECTO;
}

/** Token de conexión: solo hace falta cuando tu EmpleaTech vive en internet (lo generas en la página Autollenado). */
export async function tokenDeLaApp(): Promise<string | undefined> {
  const { token } = await chrome.storage.local.get("token");
  return typeof token === "string" && token.trim() ? token.trim() : undefined;
}
