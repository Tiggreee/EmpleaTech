import type { VacantePuntuada } from "@/core/vacantes/busqueda";
import { INFO_FUENTES, type InfoFuente } from "@/core/vacantes/fuentes";
import type { PreferenciasBusqueda } from "@/core/vacantes/preferencias";
import type { FuenteId, SalarioVacante } from "@/core/vacantes/vacante";
import type { Tono } from "@/ui/ui";

export type EstadoVacante = "nueva" | "guardada" | "descartada";
export type Guardada = VacantePuntuada & { estado: EstadoVacante; encontradaEn: string };
export type FuenteDisponible = InfoFuente & { disponible: boolean };

export interface DatosVacantes {
  vacantes: Guardada[];
  conteo: Record<EstadoVacante, number>;
  preferencias: PreferenciasBusqueda;
  fuentes: FuenteDisponible[];
}

/** fetch a la API propia: JSON de ida y vuelta y el mensaje de error del servidor si falla. */
export async function pedir<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { cache: "no-store", ...init, headers: { "Content-Type": "application/json", ...init?.headers } });
  const body = (await res.json().catch(() => null)) as (T & { error?: string }) | null;
  if (!res.ok || !body) throw new Error(body?.error ?? "No se pudo completar la operación.");
  return body;
}

export const cambiarEstadoVacante = (id: string, estado: EstadoVacante) => pedir("/api/vacantes", { method: "PATCH", body: JSON.stringify({ id, estado }) });

// ---------------------------------------------------------------------------------------------------------------
// Formato para las tarjetas

export const MODALIDAD = { remoto: "Remoto", hibrido: "Híbrido", presencial: "Presencial" } as const;
export const TONO_RECOMENDACION: Record<string, Tono> = { postular: "ok", revisar: "cian", descartar: "riesgo", "sin-analisis": "neutro" };
const PERIODO = { hora: "/h", mes: "/mes", año: "/año", proyecto: "por proyecto" } as const;

export const nombreFuente = (f: FuenteId) => INFO_FUENTES[f]?.nombre ?? f;

export function salario(s: SalarioVacante | undefined): string | null {
  if (!s) return null;
  const f = (n: number) => (n >= 10_000 ? `${Math.round(n / 1000)}k` : n.toLocaleString("es-MX"));
  const rango = s.min && s.max && s.min !== s.max ? `${f(s.min)}–${f(s.max)}` : f((s.max ?? s.min) as number);
  return `${rango} ${s.moneda ?? ""}${s.periodo ? ` ${PERIODO[s.periodo]}` : ""}`.trim();
}

export function hace(iso: string | undefined, ahora: number): string | null {
  if (!iso || !ahora) return null;
  const dias = Math.floor((ahora - new Date(iso).getTime()) / 86_400_000);
  return dias <= 0 ? "hoy" : dias === 1 ? "ayer" : `hace ${dias} días`;
}
