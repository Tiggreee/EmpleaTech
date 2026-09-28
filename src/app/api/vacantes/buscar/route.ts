import { ok, respuestaError } from "@/server/api";
import { buscarAhora } from "@/server/vacantes";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Consultar varias plataformas en paralelo puede tardar; cada una tiene su propio tiempo límite.
export const maxDuration = 60;

export async function POST() {
  try {
    return ok(await buscarAhora());
  } catch (error) {
    return respuestaError(error);
  }
}
