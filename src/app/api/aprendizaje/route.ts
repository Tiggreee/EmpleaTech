import { ok, respuestaError } from "@/server/api";
import { calcularAprendizaje } from "@/server/aprendizaje";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return ok(await calcularAprendizaje());
  } catch (error) {
    return respuestaError(error);
  }
}
