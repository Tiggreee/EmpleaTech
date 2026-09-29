import { leerJson, ok, respuestaError } from "@/server/api";
import { guardarSeguimiento, leerSeguimiento } from "@/server/freelance";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return ok({ seguimiento: await leerSeguimiento() });
  } catch (error) {
    return respuestaError(error);
  }
}

/** Guarda en qué plataformas freelance ya te registraste. */
export async function PUT(request: Request) {
  try {
    const body = await leerJson(request, 5_000);
    return ok({ seguimiento: await guardarSeguimiento(body.seguimiento) });
  } catch (error) {
    return respuestaError(error);
  }
}
