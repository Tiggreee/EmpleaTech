import type { PoolClient } from "pg";
import { APP_PROFILE_ID, APP_PROFILE_NAME } from "@/config/app";
import { sanitizarResumen } from "@/core/analisis/resumen";
import { cvActivo, estructuradoDe } from "@/core/perfil/perfil";
import { buscarVacantes, huellaPuntaje, ordenar, puntuar, type ResultadoFuente, type VacantePuntuada } from "@/core/vacantes/busqueda";
import { consultaDe, preferenciasIniciales, sanitizarPreferencias, type PreferenciasBusqueda } from "@/core/vacantes/preferencias";
import { FUENTES, type FuenteId, type Vacante } from "@/core/vacantes/vacante";
import type { Prioridad } from "@/core/seguimiento/prioridad";
import { ajustePorAprendizaje, huellaAprendizaje } from "@/core/aprendizaje/aprendizaje";
import { calcularAprendizaje } from "./aprendizaje";
import { loadState } from "./app-state";
import { getPool, withTransaction } from "./db";
import { ADAPTADORES, EMPRESAS_INICIALES, contextoReal } from "./fuentes";
import { contextoFalso } from "./fuentes/falsas";

export const ESTADOS_VACANTE = ["nueva", "guardada", "descartada"] as const;
export type EstadoVacante = (typeof ESTADOS_VACANTE)[number];

export interface VacanteGuardada extends VacantePuntuada {
  estado: EstadoVacante;
  encontradaEn: string;
}

export class ErrorVacantes extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

async function asegurarPerfil(client: PoolClient): Promise<void> {
  await client.query(`insert into profiles (id, display_name) values ($1, $2) on conflict (id) do nothing`, [APP_PROFILE_ID, APP_PROFILE_NAME]);
}

// ---------------------------------------------------------------------------------------------------------------
// Preferencias

export async function leerPreferencias(): Promise<PreferenciasBusqueda> {
  const [{ perfil }, fila] = await Promise.all([loadState(), getPool().query(`select busqueda_json from profiles where id = $1`, [APP_PROFILE_ID])]);
  const activo = cvActivo(perfil);
  const base = preferenciasIniciales(activo ? estructuradoDe(activo) : undefined, perfil.respuestas, EMPRESAS_INICIALES);
  const guardadas = fila.rows[0]?.busqueda_json;
  return guardadas && Object.keys(guardadas).length ? sanitizarPreferencias(guardadas, base) : base;
}

export async function guardarPreferencias(crudo: unknown): Promise<PreferenciasBusqueda> {
  const p = sanitizarPreferencias(crudo, await leerPreferencias());
  await withTransaction(async (client) => {
    await asegurarPerfil(client);
    await client.query(`update profiles set busqueda_json = $2::jsonb, updated_at = now() where id = $1`, [APP_PROFILE_ID, JSON.stringify(p)]);
  });
  return p;
}

// ---------------------------------------------------------------------------------------------------------------
// Vacantes

function prioridadSegura(x: unknown): Prioridad {
  const o = (typeof x === "object" && x !== null ? x : {}) as Record<string, unknown>;
  return {
    valor: typeof o.valor === "number" ? o.valor : null,
    recomendacion: (["postular", "revisar", "descartar", "sin-analisis"] as const).includes(o.recomendacion as never) ? (o.recomendacion as Prioridad["recomendacion"]) : "sin-analisis",
    factores: Array.isArray(o.factores) ? o.factores.filter((f): f is string => typeof f === "string").slice(0, 12) : [],
  };
}

/** Vuelve a puntuar las vacantes por revisar que se calcularon con otro CV u otras respuestas. */
export async function repuntuarSiCambio(ahora = new Date()): Promise<number> {
  const { perfil } = await loadState();
  const cv = cvActivo(perfil);
  if (!cv) return 0;
  const aprendizaje = await calcularAprendizaje(ahora);
  const huella = huellaPuntaje(cv, perfil.respuestas, huellaAprendizaje(aprendizaje));
  const { rows } = await getPool().query(
    `select id, datos_json from vacantes where profile_id = $1 and estado = 'nueva' and huella is distinct from $2 limit 500`,
    [APP_PROFILE_ID, huella],
  );
  if (!rows.length) return 0;
  await withTransaction(async (client) => {
    for (const r of rows) {
      const v = r.datos_json as Vacante;
      const p = puntuar(v, cv.texto, perfil.respuestas, ahora, ajustePorAprendizaje(aprendizaje, v));
      await client.query(
        `update vacantes set resumen_json = $3::jsonb, prioridad_json = $4::jsonb, score = $5, huella = $6, actualizada_en = now()
          where profile_id = $1 and id = $2`,
        [APP_PROFILE_ID, r.id, JSON.stringify(p.resumen), JSON.stringify(p.prioridad), p.prioridad.valor, huella],
      );
    }
  });
  return rows.length;
}

export async function listarVacantes(estado: EstadoVacante = "nueva", limite = 200): Promise<VacanteGuardada[]> {
  if (estado === "nueva") await repuntuarSiCambio();
  const { rows } = await getPool().query(
    `select datos_json, resumen_json, prioridad_json, estado, encontrada_en
       from vacantes
      where profile_id = $1 and estado = $2
      order by score desc nulls last, encontrada_en desc
      limit $3`,
    [APP_PROFILE_ID, estado, Math.max(1, Math.min(500, limite))],
  );
  return rows.flatMap((r) => {
    const resumen = sanitizarResumen(r.resumen_json);
    if (!resumen) return [];
    return [{ vacante: r.datos_json as Vacante, resumen, prioridad: prioridadSegura(r.prioridad_json), estado: r.estado as EstadoVacante, encontradaEn: new Date(r.encontrada_en).toISOString() }];
  });
}

export async function obtenerVacante(id: string): Promise<VacanteGuardada> {
  const { rows } = await getPool().query(
    `select datos_json, resumen_json, prioridad_json, estado, encontrada_en from vacantes where profile_id = $1 and id = $2`,
    [APP_PROFILE_ID, id.slice(0, 300)],
  );
  const r = rows[0];
  const resumen = r && sanitizarResumen(r.resumen_json);
  if (!r || !resumen) throw new ErrorVacantes(404, "Vacante no encontrada.");
  return { vacante: r.datos_json as Vacante, resumen, prioridad: prioridadSegura(r.prioridad_json), estado: r.estado as EstadoVacante, encontradaEn: new Date(r.encontrada_en).toISOString() };
}

export async function contarVacantes(): Promise<Record<EstadoVacante, number>> {
  const { rows } = await getPool().query(`select estado, count(*)::int as n from vacantes where profile_id = $1 group by estado`, [APP_PROFILE_ID]);
  const out: Record<EstadoVacante, number> = { nueva: 0, guardada: 0, descartada: 0 };
  for (const r of rows) if (ESTADOS_VACANTE.includes(r.estado)) out[r.estado as EstadoVacante] = r.n;
  return out;
}

export async function cambiarEstadoVacante(id: string, estado: EstadoVacante): Promise<void> {
  if (!ESTADOS_VACANTE.includes(estado)) throw new ErrorVacantes(400, "Estado inválido.");
  const r = await getPool().query(`update vacantes set estado = $3, actualizada_en = now() where profile_id = $1 and id = $2`, [APP_PROFILE_ID, id.slice(0, 300), estado]);
  if (!r.rowCount) throw new ErrorVacantes(404, "Vacante no encontrada.");
}

export interface EstadoFuente {
  fuente: FuenteId;
  ultimaEn: string;
  estado: string;
  detalle?: string;
}

export async function consultasPorFuente(): Promise<EstadoFuente[]> {
  const { rows } = await getPool().query(`select fuente, ultima_en, estado, detalle from consultas_fuente where profile_id = $1`, [APP_PROFILE_ID]);
  return rows
    .filter((r) => (FUENTES as readonly string[]).includes(r.fuente))
    .map((r) => ({ fuente: r.fuente as FuenteId, ultimaEn: new Date(r.ultima_en).toISOString(), estado: r.estado, ...(r.detalle ? { detalle: r.detalle } : {}) }));
}

async function guardarResultados(puntuadas: VacantePuntuada[], reporte: ResultadoFuente[], ahora: Date, huella: string): Promise<number> {
  return withTransaction(async (client) => {
    await asegurarPerfil(client);
    let nuevas = 0;
    for (const p of puntuadas) {
      // Una vacante descartada o ya guardada conserva su estado aunque vuelva a aparecer.
      const r = await client.query(
        `insert into vacantes (profile_id, id, fuente, datos_json, resumen_json, prioridad_json, score, huella, encontrada_en, actualizada_en)
         values ($1, $2, $3, $4::jsonb, $5::jsonb, $6::jsonb, $7, $9, $8, $8)
         on conflict (profile_id, id) do update
           set datos_json = excluded.datos_json, resumen_json = excluded.resumen_json, prioridad_json = excluded.prioridad_json,
               score = excluded.score, huella = excluded.huella, actualizada_en = excluded.actualizada_en
         returning (xmax = 0) as insertada`,
        [APP_PROFILE_ID, p.vacante.id, p.vacante.fuente, JSON.stringify(p.vacante), JSON.stringify(p.resumen), JSON.stringify(p.prioridad), p.prioridad.valor, ahora.toISOString(), huella],
      );
      if (r.rows[0]?.insertada) nuevas++;
    }
    for (const r of reporte) {
      if (r.estado === "omitida") continue;
      await client.query(
        `insert into consultas_fuente (profile_id, fuente, ultima_en, estado, detalle) values ($1, $2, $3, $4, $5)
         on conflict (profile_id, fuente) do update set ultima_en = excluded.ultima_en, estado = excluded.estado, detalle = excluded.detalle`,
        [APP_PROFILE_ID, r.fuente, ahora.toISOString(), r.estado, r.detalle ?? null],
      );
    }
    return nuevas;
  });
}

export interface ResultadoBusqueda {
  reporte: ResultadoFuente[];
  encontradas: number;
  nuevas: number;
}

/** Busca en las plataformas elegidas, puntúa contra el CV activo y guarda. */
export async function buscarAhora(ahora = new Date()): Promise<ResultadoBusqueda> {
  const { perfil } = await loadState();
  const cv = cvActivo(perfil);
  if (!cv) throw new ErrorVacantes(409, "Primero sube tu CV: lo usamos para buscar y ordenar las vacantes.");
  const prefs = await leerPreferencias();
  if (!prefs.fuentes.length) throw new ErrorVacantes(400, "Elige al menos una plataforma.");
  if (!prefs.palabras.length) throw new ErrorVacantes(400, "Escribe al menos un puesto o palabra clave a buscar.");

  // Solo cuentan las consultas exitosas para el intervalo: si una fuente falló, se puede reintentar.
  const ultimas = Object.fromEntries((await consultasPorFuente()).filter((c) => c.estado === "ok").map((c) => [c.fuente, new Date(c.ultimaEn)]));
  const ctx = process.env.EMPLEATECH_FUENTES_FALSAS === "1" ? contextoFalso(ahora) : contextoReal(ahora);
  const { vacantes, reporte } = await buscarVacantes(
    prefs.fuentes.map((f) => ADAPTADORES[f]),
    consultaDe(prefs, perfil.respuestas),
    ctx,
    { ultimaConsulta: ultimas },
  );
  const aprendizaje = await calcularAprendizaje(ahora);
  const puntuadas = ordenar(vacantes.map((v) => puntuar(v, cv.texto, perfil.respuestas, ahora, ajustePorAprendizaje(aprendizaje, v))));
  const nuevas = await guardarResultados(puntuadas, reporte, ahora, huellaPuntaje(cv, perfil.respuestas, huellaAprendizaje(aprendizaje)));
  return { reporte, encontradas: puntuadas.length, nuevas };
}
