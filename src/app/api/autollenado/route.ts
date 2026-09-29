import { NextResponse } from "next/server";
import { ErrorHttp, leerJson, respuestaError } from "@/server/api";
import { datosParaFormulario, guardarAprendidas, registrarEnvio } from "@/server/autollenado";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Solo la extensión de EmpleaTech habla con este endpoint: exige el encabezado propio y, si el navegador manda Origin,
 * que sea de una extensión. Una página cualquiera no puede leer tus datos (el encabezado fuerza una verificación CORS
 * que aquí no se concede a sitios web).
 */
const ENCABEZADO = "x-empleatech";

function origenPermitido(request: Request): string | null {
  const origen = request.headers.get("origin");
  if (origen && !origen.startsWith("chrome-extension://")) return null;
  return origen ?? "";
}

function verificar(request: Request): string {
  const origen = origenPermitido(request);
  if (origen === null || request.headers.get(ENCABEZADO) !== "extension") throw new ErrorHttp(403, "Solo la extensión de EmpleaTech puede usar este servicio.");
  return origen;
}

function responder(datos: unknown, origen: string, status = 200) {
  const headers: Record<string, string> = { "Cache-Control": "no-store" };
  if (origen) headers["Access-Control-Allow-Origin"] = origen;
  return NextResponse.json(datos, { status, headers });
}

function urlValida(x: unknown): string {
  if (typeof x !== "string") throw new ErrorHttp(400, "Falta la URL del formulario.");
  try {
    const u = new URL(x);
    if (u.protocol !== "https:" && u.protocol !== "http:") throw new Error();
    return u.toString();
  } catch {
    throw new ErrorHttp(400, "URL inválida.");
  }
}

export async function OPTIONS(request: Request) {
  const origen = origenPermitido(request);
  if (!origen) return new NextResponse(null, { status: 403 });
  return new NextResponse(null, {
    status: 204,
    headers: { "Access-Control-Allow-Origin": origen, "Access-Control-Allow-Methods": "GET, POST", "Access-Control-Allow-Headers": `content-type, ${ENCABEZADO}`, "Access-Control-Max-Age": "600" },
  });
}

export async function GET(request: Request) {
  try {
    const origen = verificar(request);
    const url = urlValida(new URL(request.url).searchParams.get("url"));
    return responder(await datosParaFormulario(url), origen);
  } catch (error) {
    return respuestaError(error);
  }
}

export async function POST(request: Request) {
  try {
    const origen = verificar(request);
    const body = await leerJson(request, 200_000);
    if (body.tipo === "enviada") {
      const titulo = typeof body.titulo === "string" ? body.titulo : "";
      return responder(await registrarEnvio(urlValida(body.url), titulo), origen);
    }
    if (body.tipo === "aprendizaje") return responder({ guardadas: await guardarAprendidas(body.items) }, origen);
    throw new ErrorHttp(400, "Tipo de evento desconocido.");
  } catch (error) {
    return respuestaError(error);
  }
}
