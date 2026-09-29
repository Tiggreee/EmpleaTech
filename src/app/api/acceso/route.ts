import { createHash, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { ErrorHttp, leerJson, respuestaError } from "@/server/api";
import { MIN_CONTRASENA, bloqueado, guardarHash, hashear, leerHash, registrarIntento, verificar, type Intentos } from "@/server/contrasena";
import { COOKIE_SESION, DURACION, accesoConContrasena, crearToken, secretoDeSesion, tokenValido } from "@/server/sesion";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Un solo servidor: el conteo de intentos vive en memoria.
const intentos = new Map<string, Intentos>();

function origenDe(request: Request): string {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "local";
}

function sinCache(datos: unknown, status = 200) {
  return NextResponse.json(datos, { status, headers: { "Cache-Control": "no-store" } });
}

async function conSesion(datos: unknown) {
  const res = sinCache(datos);
  res.cookies.set(COOKIE_SESION, await crearToken("sesion", secretoDeSesion()), { httpOnly: true, secure: true, sameSite: "lax", path: "/", maxAge: DURACION.sesion });
  return res;
}

const galletaDe = (request: Request) =>
  request.headers
    .get("cookie")
    ?.split(";")
    .map((c) => c.trim())
    .find((c) => c.startsWith(`${COOKIE_SESION}=`))
    ?.slice(COOKIE_SESION.length + 1);

/** El código de un solo uso se compara en tiempo constante (sobre su huella, para que midan lo mismo). */
function codigoCorrecto(dado: unknown): boolean {
  const esperado = process.env.EMPLEATECH_CODIGO_INICIAL?.trim() ?? "";
  if (esperado.length < 16 || typeof dado !== "string") return false;
  const h = (s: string) => createHash("sha256").update(s).digest();
  return timingSafeEqual(h(dado.trim()), h(esperado));
}

export async function GET(request: Request) {
  try {
    const requerido = accesoConContrasena();
    if (!requerido) return sinCache({ requerido: false, configurado: true, sesion: true });
    const [hash, sesion] = await Promise.all([leerHash(), tokenValido(galletaDe(request), "sesion", secretoDeSesion())]);
    return sinCache({ requerido: true, configurado: !!hash, sesion });
  } catch (error) {
    return respuestaError(error);
  }
}

export async function POST(request: Request) {
  try {
    if (!accesoConContrasena()) throw new ErrorHttp(404, "El inicio de sesión no está activado en esta instalación.");
    const body = await leerJson(request, 5_000);
    const origen = origenDe(request);

    if (body.accion === "token-extension") {
      if (!(await tokenValido(galletaDe(request), "sesion", secretoDeSesion()))) throw new ErrorHttp(401, "Inicia sesión primero.");
      return sinCache({ token: await crearToken("extension", secretoDeSesion()) });
    }

    const espera = bloqueado(intentos, origen);
    if (espera) throw new ErrorHttp(429, `Demasiados intentos. Espera ${espera} min.`);
    const contrasena = typeof body.contrasena === "string" ? body.contrasena : "";

    if (body.accion === "crear") {
      const valido = codigoCorrecto(body.codigo);
      registrarIntento(intentos, origen, valido);
      if (!valido) throw new ErrorHttp(401, "El código de acceso no es correcto.");
      if (contrasena.length < MIN_CONTRASENA) throw new ErrorHttp(400, `Usa al menos ${MIN_CONTRASENA} caracteres.`);
      if (!(await guardarHash(await hashear(contrasena), true))) throw new ErrorHttp(409, "Ya existe una contraseña. Inicia sesión.");
      return conSesion({ ok: true });
    }

    if (body.accion === "entrar") {
      const hash = await leerHash();
      if (!hash) throw new ErrorHttp(409, "Primero crea tu contraseña con tu código de acceso.");
      const valida = await verificar(contrasena, hash);
      registrarIntento(intentos, origen, valida);
      if (!valida) throw new ErrorHttp(401, "Contraseña incorrecta.");
      return conSesion({ ok: true });
    }

    throw new ErrorHttp(400, "Acción desconocida.");
  } catch (error) {
    return respuestaError(error);
  }
}

/** Cerrar sesión. */
export async function DELETE() {
  const res = sinCache({ ok: true });
  res.cookies.set(COOKIE_SESION, "", { httpOnly: true, secure: true, sameSite: "lax", path: "/", maxAge: 0 });
  return res;
}
