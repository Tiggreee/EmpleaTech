import { NextResponse, type NextRequest } from "next/server";
import { hostsExtra, rechazoDeAcceso } from "@/server/acceso";
import { COOKIE_SESION, accesoConContrasena, rutaPublica, secretoDeSesion, tokenValido } from "@/server/sesion";

const json = (error: string, status: number) => NextResponse.json({ error }, { status, headers: { "Cache-Control": "no-store" } });

/**
 * Filtro antes de cada página y API. En tu computadora: solo ella y ninguna otra página puede escribir (ver
 * server/acceso). En internet (EMPLEATECH_AUTH=1): además, sin tu sesión no se ve nada; la extensión entra con su
 * token y el cron diario con su clave (ver server/sesion).
 */
export async function proxy(request: NextRequest) {
  const rechazo = rechazoDeAcceso(
    {
      metodo: request.method,
      host: request.headers.get("host"),
      origen: request.headers.get("origin"),
      sitio: request.headers.get("sec-fetch-site"),
    },
    hostsExtra(process.env.EMPLEATECH_HOSTS),
    { revisarHost: process.env.VERCEL !== "1" },
  );
  if (rechazo) return json(rechazo.mensaje, rechazo.status);
  if (!accesoConContrasena()) return NextResponse.next();

  const ruta = request.nextUrl.pathname;
  // El cron valida su propia clave (CRON_SECRET) en su ruta.
  if (rutaPublica(ruta) || ruta.startsWith("/api/cron/")) return NextResponse.next();

  let secreto: string;
  try {
    secreto = secretoDeSesion();
  } catch {
    // Mejor cerrado que abierto: sin secreto configurado nadie entra.
    return json("Falta configurar el inicio de sesión (EMPLEATECH_SECRETO).", 503);
  }

  if (ruta.startsWith("/api/autollenado")) {
    // La verificación previa de CORS no lleva credenciales; la ruta decide qué orígenes acepta.
    if (request.method === "OPTIONS") return NextResponse.next();
    const bearer = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
    if (await tokenValido(bearer, "extension", secreto)) return NextResponse.next();
  }
  if (await tokenValido(request.cookies.get(COOKIE_SESION)?.value, "sesion", secreto)) return NextResponse.next();

  if (ruta.startsWith("/api/")) return json("Inicia sesión.", 401);
  const destino = new URL("/entrar", request.url);
  destino.search = "";
  destino.searchParams.set("volver", `${ruta}${request.nextUrl.search}`);
  return NextResponse.redirect(destino);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
