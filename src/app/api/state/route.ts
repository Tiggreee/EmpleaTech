import { NextResponse } from "next/server";
import { clearState, loadState, saveState, type EstadoPersistido } from "@/server/app-state";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function mensaje(error: unknown): string {
  return error instanceof Error ? error.message : "Error inesperado.";
}

export async function GET() {
  try {
    const estado = await loadState();
    return NextResponse.json(estado, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return NextResponse.json({ error: mensaje(error) }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const body = (await request.json()) as { perfil?: unknown; postulaciones?: unknown };
    const estado = await saveState(body as Partial<EstadoPersistido>);
    return NextResponse.json(estado, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return NextResponse.json({ error: mensaje(error) }, { status: 500 });
  }
}

export async function DELETE() {
  try {
    await clearState();
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: mensaje(error) }, { status: 500 });
  }
}
