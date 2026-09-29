import { leerJson, ok, respuestaError } from "@/server/api";
import { clearState, loadState, saveState, type EstadoPersistido } from "@/server/app-state";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const MAX_BYTES_ESTADO = 1_000_000;

export async function GET() {
  try {
    return ok(await loadState());
  } catch (error) {
    return respuestaError(error);
  }
}

export async function PUT(request: Request) {
  try {
    const body = (await leerJson(request, MAX_BYTES_ESTADO)) as Partial<EstadoPersistido>;
    return ok(await saveState(body));
  } catch (error) {
    return respuestaError(error);
  }
}

export async function DELETE() {
  try {
    await clearState();
    return ok({ ok: true });
  } catch (error) {
    return respuestaError(error);
  }
}
