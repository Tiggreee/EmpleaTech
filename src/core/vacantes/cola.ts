import type { Postulacion } from "../seguimiento/seguimiento";
import type { VacantePuntuada } from "./busqueda";
import type { FuenteId } from "./vacante";

export interface AjustesCola {
  /** Cuántos empleos quieres postular al día. */
  metaDiaria: number;
  /** Cuántas propuestas freelance al día (0: ninguna). */
  metaFreelance: number;
  /** Tope por plataforma, para no depender de una sola fuente. */
  topePorFuente: number;
}

/**
 * 10 empleos y 5 propuestas freelance al día: cada una lleva CV y carta (o propuesta) a la medida y hay que revisarlas;
 * con metas grandes se cuelan las que casi no encajan.
 */
export const AJUSTES_COLA_INICIALES: AjustesCola = { metaDiaria: 10, metaFreelance: 5, topePorFuente: 10 };

/** Plataformas de proyectos: una postulación a una de ellas cuenta para la meta de freelance. */
const HOSTS_FREELANCE = /(^|\.)(freelancer\.com|usebraintrust\.com|workana\.com|upwork\.com)$/i;

export function esPostulacionFreelance(p: Postulacion): boolean {
  if (!p.url) return false;
  try {
    return HOSTS_FREELANCE.test(new URL(p.url).hostname);
  } catch {
    return false;
  }
}

/** Mismo día calendario en la zona horaria de quien usa la app. */
export function esMismoDia(iso: string, hoy: Date): boolean {
  const d = new Date(iso);
  return d.getFullYear() === hoy.getFullYear() && d.getMonth() === hoy.getMonth() && d.getDate() === hoy.getDate();
}

const hoyMismo = (postulaciones: Postulacion[], hoy: Date) => postulaciones.filter((p) => p.postuladaEn && esMismoDia(p.postuladaEn, hoy));

export function enviadasHoy(postulaciones: Postulacion[], hoy: Date): number {
  return hoyMismo(postulaciones, hoy).length;
}

export function enviadasHoyPorTipo(postulaciones: Postulacion[], hoy: Date): { empleos: number; freelance: number } {
  const hechas = hoyMismo(postulaciones, hoy);
  const freelance = hechas.filter(esPostulacionFreelance).length;
  return { empleos: hechas.length - freelance, freelance };
}

export interface Avance {
  enviadas: number;
  meta: number;
}

export interface Cola {
  items: VacantePuntuada[];
  enviadasHoy: number;
  faltanHoy: number;
  empleos: Avance;
  freelance: Avance;
}

/**
 * Las mejores vacantes para hoy: sin las que conviene descartar, con un tope por plataforma y hasta completar cada meta
 * (empleos y proyectos freelance por separado). Las que no tienen análisis suficiente van al final: se pueden revisar,
 * pero no desplazan a las que sí encajan.
 */
export function armarCola(vacantes: VacantePuntuada[], postulaciones: Postulacion[], ajustes: AjustesCola, hoy: Date): Cola {
  const hechas = enviadasHoyPorTipo(postulaciones, hoy);
  const faltan = { empleo: Math.max(0, ajustes.metaDiaria - hechas.empleos), proyecto: Math.max(0, ajustes.metaFreelance - hechas.freelance) };
  const tomadas = { empleo: 0, proyecto: 0 };
  const porFuente = new Map<FuenteId, number>();
  const items: VacantePuntuada[] = [];
  const candidatas = vacantes
    .filter((v) => v.prioridad.recomendacion !== "descartar")
    .sort((a, b) => (b.prioridad.valor ?? -1) - (a.prioridad.valor ?? -1));
  for (const v of candidatas) {
    if (tomadas.empleo >= faltan.empleo && tomadas.proyecto >= faltan.proyecto) break;
    const tipo = v.vacante.tipo === "proyecto" ? "proyecto" : "empleo";
    if (tomadas[tipo] >= faltan[tipo]) continue;
    const n = porFuente.get(v.vacante.fuente) ?? 0;
    if (n >= ajustes.topePorFuente) continue;
    porFuente.set(v.vacante.fuente, n + 1);
    tomadas[tipo]++;
    items.push(v);
  }
  return {
    items,
    enviadasHoy: hechas.empleos + hechas.freelance,
    faltanHoy: faltan.empleo + faltan.proyecto,
    empleos: { enviadas: hechas.empleos, meta: ajustes.metaDiaria },
    freelance: { enviadas: hechas.freelance, meta: ajustes.metaFreelance },
  };
}

/** El motivo principal de encaje, en una línea, para decidir rápido. */
export function motivoPrincipal(v: VacantePuntuada): string {
  const r = v.resumen;
  if (r.total > 0) return `Cubres ${r.cubiertas} de ${r.total} requisitos${r.brechas.length ? `; te falta ${r.brechas.slice(0, 2).join(" y ")}` : ""}.`;
  return v.prioridad.factores[0] ?? "Sin análisis suficiente.";
}
