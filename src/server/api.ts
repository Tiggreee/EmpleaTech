import { NextResponse } from "next/server";

/** Error con código HTTP para los Route Handlers. */
export class ErrorHttp extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

export function respuestaError(error: unknown) {
  const status = typeof (error as { status?: unknown })?.status === "number" ? (error as { status: number }).status : 500;
  const mensaje = error instanceof Error && status < 500 ? error.message : "Error inesperado en el servidor.";
  if (status >= 500) console.error(error);
  return NextResponse.json({ error: mensaje }, { status, headers: { "Cache-Control": "no-store" } });
}

export function ok(datos: unknown) {
  return NextResponse.json(datos, { headers: { "Cache-Control": "no-store" } });
}

/** Cuerpo JSON (objeto) con tope de tamaño. */
export async function leerJson(request: Request, maxBytes = 100_000): Promise<Record<string, unknown>> {
  if (!(request.headers.get("content-type") ?? "").toLowerCase().includes("application/json")) {
    throw new ErrorHttp(415, "Content-Type debe ser application/json.");
  }
  const raw = await request.text();
  if (new TextEncoder().encode(raw).length > maxBytes) throw new ErrorHttp(413, "La solicitud es demasiado grande.");
  let body: unknown;
  try {
    body = raw ? JSON.parse(raw) : {};
  } catch {
    throw new ErrorHttp(400, "JSON inválido.");
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) throw new ErrorHttp(400, "Se esperaba un objeto JSON.");
  return body as Record<string, unknown>;
}
