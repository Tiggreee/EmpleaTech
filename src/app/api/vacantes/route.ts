import { INFO_FUENTES } from "@/core/vacantes/fuentes";
import { ErrorHttp, leerJson, ok, respuestaError } from "@/server/api";
import { clavesDelEntorno } from "@/server/fuentes";
import {
  ESTADOS_VACANTE,
  cambiarEstadoVacante,
  consultasPorFuente,
  contarVacantes,
  guardarPreferencias,
  leerPreferencias,
  listarVacantes,
  type EstadoVacante,
} from "@/server/vacantes";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function fuentesDisponibles() {
  const claves = clavesDelEntorno();
  return Object.values(INFO_FUENTES).map((f) => ({ ...f, disponible: f.claves.every((k) => !!claves[k]) }));
}

export async function GET(request: Request) {
  try {
    const estado = new URL(request.url).searchParams.get("estado") ?? "nueva";
    if (!ESTADOS_VACANTE.includes(estado as EstadoVacante)) throw new ErrorHttp(400, "Estado inválido.");
    const [vacantes, conteo, preferencias, consultas] = await Promise.all([
      listarVacantes(estado as EstadoVacante),
      contarVacantes(),
      leerPreferencias(),
      consultasPorFuente(),
    ]);
    return ok({ vacantes, conteo, preferencias, consultas, fuentes: fuentesDisponibles() });
  } catch (error) {
    return respuestaError(error);
  }
}

/** Guarda las preferencias de búsqueda (plataformas, palabras, solo remoto, empresas). */
export async function PUT(request: Request) {
  try {
    return ok({ preferencias: await guardarPreferencias(await leerJson(request)) });
  } catch (error) {
    return respuestaError(error);
  }
}

/** Cambia el estado de una vacante: guardada (pasó al tracker) o descartada. */
export async function PATCH(request: Request) {
  try {
    const body = await leerJson(request, 2_000);
    if (typeof body.id !== "string" || !body.id) throw new ErrorHttp(400, "Falta el id de la vacante.");
    await cambiarEstadoVacante(body.id, body.estado as EstadoVacante);
    return ok({ ok: true, conteo: await contarVacantes() });
  } catch (error) {
    return respuestaError(error);
  }
}
