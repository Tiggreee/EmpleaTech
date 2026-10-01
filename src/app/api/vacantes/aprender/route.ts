import { ok, respuestaError } from "@/server/api";
import { oportunidadesDeMejora } from "@/server/vacantes";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Qué agregar a tu CV o aprender para subir el puntaje de tus vacantes (tabla del panel). */
export async function GET() {
  try {
    return ok(await oportunidadesDeMejora());
  } catch (error) {
    return respuestaError(error);
  }
}
