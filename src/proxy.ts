import { NextResponse, type NextRequest } from "next/server";
import { hostsExtra, rechazoDeAcceso } from "@/server/acceso";

/** Filtro antes de cada página y API: solo tu computadora, y ninguna otra página puede escribir (ver server/acceso). */
export function proxy(request: NextRequest) {
  const rechazo = rechazoDeAcceso(
    {
      metodo: request.method,
      host: request.headers.get("host"),
      origen: request.headers.get("origin"),
      sitio: request.headers.get("sec-fetch-site"),
    },
    hostsExtra(process.env.EMPLEATECH_HOSTS),
  );
  if (!rechazo) return NextResponse.next();
  return NextResponse.json({ error: rechazo.mensaje }, { status: rechazo.status, headers: { "Cache-Control": "no-store" } });
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
