import { NextResponse, type NextRequest } from "next/server";
import { hostsExtra, rechazoDeAcceso } from "@/server/acceso";
import { selloVale } from "@/server/cuenta";
import { COOKIE_SESION, accesoConContrasena, leerToken, rutaPublica, secretoDeSesion, type TipoToken } from "@/server/sesion";

const json = (error: string, status: number) => NextResponse.json({ error }, { status, headers: { "Cache-Control": "no-store" } });

/**
 * Filtro antes de cada página y API. En tu computadora: solo ella y ninguna otra página puede escribir (ver
 * server/acceso). En internet (EMPLEATECH_AUTH=1): además, sin tu sesión no se ve nada; la extensión entra con su
 * token y el cron diario con su clave (ver server/sesion). Un token solo vale si trae el sello vigente de tu cuenta:
 * cambiar la contraseña o cerrar sesión en todos lados deja fuera a los anteriores en la siguiente petición.
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

  const vale = async (token: string | null | undefined, tipo: TipoToken) => {
    const t = await leerToken(token, tipo, secreto);
    return !!t && (await selloVale(t.sello));
  };
  try {
    if (ruta.startsWith("/api/autollenado")) {
      // La verificación previa de CORS no lleva credenciales; la ruta decide qué orígenes acepta.
      if (request.method === "OPTIONS") return NextResponse.next();
      if (await vale(request.headers.get("authorization")?.replace(/^Bearer\s+/i, ""), "extension")) return NextResponse.next();
    }
    if (await vale(request.cookies.get(COOKIE_SESION)?.value, "sesion")) return NextResponse.next();
  } catch (error) {
    console.error(error);
    return json("No pude revisar tu sesión. Intenta de nuevo en un momento.", 503);
  }

  if (ruta.startsWith("/api/")) return json("Inicia sesión.", 401);
  const destino = new URL("/entrar", request.url);
  destino.search = "";
  destino.searchParams.set("volver", `${ruta}${request.nextUrl.search}`);
  return NextResponse.redirect(destino);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
