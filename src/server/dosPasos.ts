import { NextResponse } from "next/server";
import { SITIO } from "@/content/sitio";
import { gastarCodigoRespaldo, selloVale, usarPasoTotp, type Cuenta } from "./cuenta";
import { COOKIE_PASO2, COOKIE_SESION, DURACION, crearToken, leerToken, secretoDeSesion } from "./sesion";
import { descifrar, huellaRespaldo, pareceRespaldo, verificarTotp } from "./totp";

/** Lo que comparten /api/acceso y /api/seguridad: galletas de sesión y el segundo paso. */

const GALLETA = { httpOnly: true, secure: true, sameSite: "lax" } as const;
export const RUTA_PASO2 = "/api/acceso";

/** Para quien ataca tu instalación, el dominio también es una palabra obvia. */
export const palabrasDelSitio = () => new URL(SITIO).hostname.split(/[.-]/);

export function galletaDe(request: Request, nombre: string): string | undefined {
  return request.headers
    .get("cookie")
    ?.split(";")
    .map((c) => c.trim())
    .find((c) => c.startsWith(`${nombre}=`))
    ?.slice(nombre.length + 1);
}

export function sinCache(datos: unknown, status = 200) {
  return NextResponse.json(datos, { status, headers: { "Cache-Control": "no-store" } });
}

/** Respuesta que abre (o renueva) tu sesión con el sello vigente y descarta un segundo paso a medias. */
export async function conSesion(datos: unknown, sello: string) {
  const res = sinCache(datos);
  res.cookies.set(COOKIE_SESION, await crearToken("sesion", secretoDeSesion(), sello), { ...GALLETA, path: "/", maxAge: DURACION.sesion });
  res.cookies.set(COOKIE_PASO2, "", { ...GALLETA, path: RUTA_PASO2, maxAge: 0 });
  return res;
}

/** Contraseña correcta; ahora el código. */
export async function conPaso2(sello: string) {
  const res = sinCache({ segundoPaso: true });
  res.cookies.set(COOKIE_PASO2, await crearToken("paso2", secretoDeSesion(), sello), { ...GALLETA, path: RUTA_PASO2, maxAge: DURACION.paso2 });
  return res;
}

export function sinSesion(datos: unknown) {
  const res = sinCache(datos);
  res.cookies.set(COOKIE_SESION, "", { ...GALLETA, path: "/", maxAge: 0 });
  res.cookies.set(COOKIE_PASO2, "", { ...GALLETA, path: RUTA_PASO2, maxAge: 0 });
  return res;
}

/** El sello de la sesión de esta petición, si es válida y sigue vigente. */
export async function sesionVigente(request: Request, tipo: "sesion" | "paso2" = "sesion"): Promise<string | null> {
  const t = await leerToken(galletaDe(request, tipo === "sesion" ? COOKIE_SESION : COOKIE_PASO2), tipo, secretoDeSesion());
  return t && (await selloVale(t.sello)) ? t.sello : null;
}

export type ResultadoCodigo = { ok: true; restantes?: number } | { ok: false; mensaje: string };

const INCORRECTO = "El código no es correcto o ya se usó.";

/**
 * Comprueba el código de tu app de autenticación o uno de respaldo y, si es bueno, lo marca como usado para que no
 * sirva dos veces. `restantes` viene cuando se gastó uno de respaldo.
 */
export async function comprobarSegundoFactor(cuenta: Cuenta, codigo: unknown, ahora = Date.now()): Promise<ResultadoCodigo> {
  if (typeof codigo !== "string" || !cuenta.totpActivo) return { ok: false, mensaje: INCORRECTO };
  if (pareceRespaldo(codigo)) {
    const quedan = await gastarCodigoRespaldo(huellaRespaldo(codigo));
    return quedan === null ? { ok: false, mensaje: INCORRECTO } : { ok: true, restantes: quedan };
  }
  const secreto = cuenta.totpSecreto ? descifrar(cuenta.totpSecreto, secretoDeSesion()) : null;
  if (!secreto) return { ok: false, mensaje: "No pude leer tu verificación en dos pasos (¿cambió EMPLEATECH_SECRETO?). Entra con un código de respaldo." };
  const paso = verificarTotp(secreto, codigo, ahora, cuenta.totpUltimoPaso);
  if (paso === null || !(await usarPasoTotp(paso))) return { ok: false, mensaje: INCORRECTO };
  return { ok: true };
}
