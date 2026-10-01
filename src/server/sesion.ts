/**
 * Acceso cuando EmpleaTech vive en internet (EMPLEATECH_AUTH=1). En tu computadora no hace falta: solo ella puede
 * abrirla. Los tokens van firmados con HMAC-SHA256 (Web Crypto): «tipo.sello.vencimiento.firma». El sello es el de tu
 * cuenta (ver server/cuenta): cambia al cambiar la contraseña, activar la verificación en dos pasos o cerrar sesión en
 * todos lados, y con eso todos los tokens anteriores dejan de servir aunque no hayan vencido.
 */

export type TipoToken = "sesion" | "extension" | "paso2";

export const COOKIE_SESION = "et_sesion";
/** Contraseña correcta, falta el código de la app de autenticación. Dura 5 minutos. */
export const COOKIE_PASO2 = "et_paso2";
export const DURACION = { sesion: 30 * 24 * 3600, extension: 365 * 24 * 3600, paso2: 5 * 60 } as const;

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

export async function crearToken(tipo: TipoToken, secreto: string, sello: string, ahoraMs = Date.now()): Promise<string> {
  if (!/^[a-f0-9]{16,64}$/.test(sello)) throw new Error("Sello de sesión inválido.");
  const vence = Math.floor(ahoraMs / 1000) + DURACION[tipo];
  const datos = `${tipo}.${sello}.${vence}`;
  return `${datos}.${await firmar(datos, secreto)}`;
}

/** El sello del token si la firma es buena, es del tipo pedido y no ha vencido; si no, null. Falta comparar el sello. */
export async function leerToken(token: string | null | undefined, tipo: TipoToken, secreto: string, ahoraMs = Date.now()): Promise<{ sello: string } | null> {
  if (!token) return null;
  const partes = token.split(".");
  if (partes.length !== 4) return null;
  const [t, sello, vence, firma] = partes;
  if (t !== tipo || !/^[a-f0-9]{16,64}$/.test(sello) || !/^\d{9,12}$/.test(vence) || Number(vence) * 1000 <= ahoraMs) return null;
  return iguales(firma, await firmar(`${t}.${sello}.${vence}`, secreto)) ? { sello } : null;
}

/** Rutas que se pueden ver sin sesión: la pantalla de entrada y lo que el navegador pide solo (íconos, manifest). */
export function rutaPublica(ruta: string): boolean {
  return (
    ruta === "/entrar" ||
    ruta === "/privacidad" ||
    ruta.startsWith("/api/acceso") ||
    /^\/(favicon\.ico|icon(\/.*)?|apple-icon.*|manifest\.webmanifest|robots\.txt|opengraph-image.*|sw\.js)$/.test(ruta)
  );
}
