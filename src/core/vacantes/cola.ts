import type { Postulacion } from "../seguimiento/seguimiento";
import type { VacantePuntuada } from "./busqueda";
import type { FuenteId } from "./vacante";

export interface AjustesCola {
  /** Cuántas postulaciones quieres enviar al día. */
  metaDiaria: number;
  /** Tope por plataforma, para no depender de una sola fuente. */
  topePorFuente: number;
}

/** 10 al día: cada una lleva CV y carta a la medida y hay que revisarlos; con 50 se cuelan las que casi no encajan. */
export const AJUSTES_COLA_INICIALES: AjustesCola = { metaDiaria: 10, topePorFuente: 10 };

/** Mismo día calendario en la zona horaria de quien usa la app. */
export function esMismoDia(iso: string, hoy: Date): boolean {
  const d = new Date(iso);
  return d.getFullYear() === hoy.getFullYear() && d.getMonth() === hoy.getMonth() && d.getDate() === hoy.getDate();
}

export function enviadasHoy(postulaciones: Postulacion[], hoy: Date): number {
  return postulaciones.filter((p) => p.postuladaEn && esMismoDia(p.postuladaEn, hoy)).length;
}

export interface Cola {
  items: VacantePuntuada[];
  enviadasHoy: number;
  faltanHoy: number;
}

/**
 * Las mejores vacantes para hoy: sin las que conviene descartar, con un tope por plataforma y hasta completar la meta.
 * Las que no tienen análisis suficiente van al final: se pueden revisar, pero no desplazan a las que sí encajan.
 */
export function armarCola(vacantes: VacantePuntuada[], postulaciones: Postulacion[], ajustes: AjustesCola, hoy: Date): Cola {
  const yaEnviadas = enviadasHoy(postulaciones, hoy);
  const faltan = Math.max(0, ajustes.metaDiaria - yaEnviadas);
  const porFuente = new Map<FuenteId, number>();
  const items: VacantePuntuada[] = [];
  const candidatas = vacantes
    .filter((v) => v.prioridad.recomendacion !== "descartar")
    .sort((a, b) => (b.prioridad.valor ?? -1) - (a.prioridad.valor ?? -1));
  for (const v of candidatas) {
    if (items.length >= faltan) break;
    const n = porFuente.get(v.vacante.fuente) ?? 0;
    if (n >= ajustes.topePorFuente) continue;
    porFuente.set(v.vacante.fuente, n + 1);
    items.push(v);
  }
  return { items, enviadasHoy: yaEnviadas, faltanHoy: faltan };
}

/** El motivo principal de encaje, en una línea, para decidir rápido. */
export function motivoPrincipal(v: VacantePuntuada): string {
  const r = v.resumen;
  if (r.total > 0) return `Cubres ${r.cubiertas} de ${r.total} requisitos${r.brechas.length ? `; te falta ${r.brechas.slice(0, 2).join(" y ")}` : ""}.`;
  return v.prioridad.factores[0] ?? "Sin análisis suficiente.";
}
