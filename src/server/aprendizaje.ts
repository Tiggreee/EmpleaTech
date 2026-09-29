import { APP_PROFILE_ID } from "@/config/app";
import { aprender, registrosDe, type Aprendizaje } from "@/core/aprendizaje/aprendizaje";
import { INFO_FUENTES } from "@/core/vacantes/fuentes";
import type { FuenteId, Vacante } from "@/core/vacantes/vacante";
import { loadState } from "./app-state";
import { getPool } from "./db";

export interface SaltadasPorFuente {
  fuente: string;
  /** Vacantes que ya revisaste (guardadas o descartadas). */
  revisadas: number;
  saltadas: number;
}

export interface Resultados extends Aprendizaje {
  /** Señal temprana: qué plataformas te traen vacantes que terminas saltando. */
  saltadas: SaltadasPorFuente[];
}

/** Lo aprendido de tus postulaciones enviadas, cruzadas con las vacantes de donde salieron. */
export async function calcularAprendizaje(ahora = new Date()): Promise<Resultados> {
  const [{ perfil, postulaciones }, filas] = await Promise.all([
    loadState(),
    getPool().query(`select datos_json, estado, fuente from vacantes where profile_id = $1`, [APP_PROFILE_ID]),
  ]);
  const vacantes = filas.rows.map((r) => r.datos_json as Vacante);
  const nombresCv = Object.fromEntries(perfil.cvs.map((c) => [c.id, c.nombre]));
  const a = aprender(registrosDe(postulaciones, vacantes, nombresCv), ahora);

  const porFuente = new Map<string, SaltadasPorFuente>();
  for (const r of filas.rows) {
    if (r.estado === "nueva") continue;
    const nombre = INFO_FUENTES[r.fuente as FuenteId]?.nombre ?? r.fuente;
    const s = porFuente.get(nombre) ?? { fuente: nombre, revisadas: 0, saltadas: 0 };
    s.revisadas++;
    if (r.estado === "descartada") s.saltadas++;
    porFuente.set(nombre, s);
  }
  return { ...a, saltadas: [...porFuente.values()].sort((x, y) => y.revisadas - x.revisadas) };
}
