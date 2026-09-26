import type { Resultado } from "./analizador";
import type { Diagnostico } from "../radar/radar";

/** Foto compacta de un análisis: lo que se guarda junto a cada oferta. */
export interface ResumenAnalisis {
  score: number | null;
  veredicto: string;
  cubiertas: number;
  total: number;
  brechas: string[];
  transferibles: string[];
  riesgo: Diagnostico["nivel"];
  alertas: { alta: number; media: number; baja: number };
  analizadaEn: string;
}

export function resumir(r: Resultado, d: Diagnostico, ahora: Date): ResumenAnalisis {
  const faltantes = r.hallazgos.filter((h) => h.estado === "faltante" && h.nivel !== "deseable");
  return {
    score: r.score,
    veredicto: r.veredicto,
    cubiertas: r.desglose.requerida.cubiertas,
    total: r.desglose.requerida.total,
    brechas: faltantes.slice(0, 8).map((h) => h.label),
    transferibles: r.hallazgos.filter((h) => h.estado === "transferible").slice(0, 8).map((h) => h.label),
    riesgo: d.nivel,
    alertas: {
      alta: d.alertas.filter((a) => a.severidad === "alta").length,
      media: d.alertas.filter((a) => a.severidad === "media").length,
      baja: d.alertas.filter((a) => a.severidad === "baja").length,
    },
    analizadaEn: ahora.toISOString(),
  };
}

const NIVELES = ["limpia", "precaucion", "riesgo"] as const;

function entero(x: unknown, max: number): number {
  return typeof x === "number" && Number.isFinite(x) ? Math.max(0, Math.min(max, Math.round(x))) : 0;
}

function lista(x: unknown): string[] {
  return Array.isArray(x) ? x.filter((s): s is string => typeof s === "string").map((s) => s.slice(0, 80)).slice(0, 8) : [];
}

export function sanitizarResumen(x: unknown): ResumenAnalisis | undefined {
  if (typeof x !== "object" || x === null) return undefined;
  const o = x as Record<string, unknown>;
  const fecha = typeof o.analizadaEn === "string" && !Number.isNaN(new Date(o.analizadaEn).getTime()) ? new Date(o.analizadaEn).toISOString() : new Date(0).toISOString();
  const a = (typeof o.alertas === "object" && o.alertas !== null ? o.alertas : {}) as Record<string, unknown>;
  return {
    score: typeof o.score === "number" && o.score >= 0 && o.score <= 100 ? Math.round(o.score) : null,
    veredicto: typeof o.veredicto === "string" ? o.veredicto.slice(0, 60) : "",
    cubiertas: entero(o.cubiertas, 500),
    total: entero(o.total, 500),
    brechas: lista(o.brechas),
    transferibles: lista(o.transferibles),
    riesgo: NIVELES.includes(o.riesgo as never) ? (o.riesgo as ResumenAnalisis["riesgo"]) : "limpia",
    alertas: { alta: entero(a.alta, 50), media: entero(a.media, 50), baja: entero(a.baja, 50) },
    analizadaEn: fecha,
  };
}
