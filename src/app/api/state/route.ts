import { NextResponse } from "next/server";
import { clearState, loadState, saveState, type EstadoPersistido } from "@/server/app-state";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const MAX_BYTES_ESTADO = 1_000_000;

class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

function mensaje(error: unknown): string {
  return error instanceof Error ? error.message : "Error inesperado.";
}

function errorJson(error: unknown) {
  return NextResponse.json(
    { error: mensaje(error) },
    { status: error instanceof HttpError ? error.status : 500 },
  );
}

async function leerPayload(request: Request): Promise<Partial<EstadoPersistido>> {
  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().includes("application/json")) {
    throw new HttpError(415, "Content-Type debe ser application/json.");
  }
  const raw = await request.text();
  const bytes = new TextEncoder().encode(raw).length;
  if (bytes > MAX_BYTES_ESTADO) {
    throw new HttpError(413, `El estado supera el l?mite de ${(MAX_BYTES_ESTADO / 1024).toFixed(0)} KB.`);
  }

  let body: unknown;
  try {
    body = raw ? JSON.parse(raw) : {};
  } catch {
    throw new HttpError(400, "JSON inv?lido.");
  }

  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new HttpError(400, "El payload debe ser un objeto JSON.");
  }
  return body as Partial<EstadoPersistido>;
}

export async function GET() {
  try {
    const estado = await loadState();
    return NextResponse.json(estado, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return errorJson(error);
  }
}

export async function PUT(request: Request) {
  try {
    const body = await leerPayload(request);
    const estado = await saveState(body);
    return NextResponse.json(estado, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return errorJson(error);
  }
}

export async function DELETE() {
  try {
    await clearState();
    return NextResponse.json({ ok: true });
  } catch (error) {
    return errorJson(error);
  }
}
