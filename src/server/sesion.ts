/**
 * Acceso cuando EmpleaTech vive en internet (EMPLEATECH_AUTH=1). En tu computadora no hace falta: solo ella puede
 * abrirla. Los tokens van firmados con HMAC-SHA256 (Web Crypto, para que el proxy los valide sin tocar la base):
 * «tipo.vencimiento.firma». Para cerrar todas las sesiones y desconectar la extensión basta con cambiar
 * EMPLEATECH_SECRETO.
 */

export type TipoToken = "sesion" | "extension";

export const COOKIE_SESION = "et_sesion";
export const DURACION = { sesion: 30 * 24 * 3600, extension: 365 * 24 * 3600 } as const;

export const accesoConContrasena = (env: Record<string, string | undefined> = process.env) => env.EMPLEATECH_AUTH === "1";

export function secretoDeSesion(env: Record<string, string | undefined> = process.env): string {
  const s = env.EMPLEATECH_SECRETO?.trim() ?? "";
  if (s.length < 32) throw new Error("Falta EMPLEATECH_SECRETO (al menos 32 caracteres) para el inicio de sesión.");
  return s;
}

const base64url = (bytes: ArrayBuffer) =>
  btoa(String.fromCharCode(...new Uint8Array(bytes)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

async function firmar(datos: string, secreto: string): Promise<string> {
  const llave = await crypto.subtle.importKey("raw", new TextEncoder().encode(secreto), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return base64url(await crypto.subtle.sign("HMAC", llave, new TextEncoder().encode(datos)));
}

/** Comparación en tiempo constante: no revela cuántos caracteres de una firma falsa eran correctos. */
function iguales(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let dif = 0;
  for (let i = 0; i < a.length; i++) dif |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return dif === 0;
}

export async function crearToken(tipo: TipoToken, secreto: string, ahoraMs = Date.now()): Promise<string> {
  const vence = Math.floor(ahoraMs / 1000) + DURACION[tipo];
  const datos = `${tipo}.${vence}`;
  return `${datos}.${await firmar(datos, secreto)}`;
}

export async function tokenValido(token: string | null | undefined, tipo: TipoToken, secreto: string, ahoraMs = Date.now()): Promise<boolean> {
  if (!token) return false;
  const partes = token.split(".");
  if (partes.length !== 3) return false;
  const [t, vence, firma] = partes;
  if (t !== tipo || !/^\d{9,12}$/.test(vence) || Number(vence) * 1000 <= ahoraMs) return false;
  return iguales(firma, await firmar(`${t}.${vence}`, secreto));
}

/** Rutas que se pueden ver sin sesión: la pantalla de entrada y lo que el navegador pide solo (íconos, manifest). */
export function rutaPublica(ruta: string): boolean {
  return (
    ruta === "/entrar" ||
    ruta.startsWith("/api/acceso") ||
    /^\/(favicon\.ico|icon(\/.*)?|apple-icon.*|manifest\.webmanifest|robots\.txt|opengraph-image.*|sw\.js)$/.test(ruta)
  );
}
