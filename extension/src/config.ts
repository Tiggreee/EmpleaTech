/** Dónde corre tu EmpleaTech. Por defecto, en tu computadora. */
export const BASE_POR_DEFECTO = "http://localhost:3000";

export async function baseDeLaApp(): Promise<string> {
  const { base } = await chrome.storage.local.get("base");
  return typeof base === "string" && base ? base.replace(/\/+$/, "") : BASE_POR_DEFECTO;
}
