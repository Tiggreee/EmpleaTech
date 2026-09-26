import type { ResumenAnalisis } from "../analisis/resumen";
import type { Postulacion } from "./seguimiento";

export type Recomendacion = "postular" | "revisar" | "descartar" | "sin-analisis";

export interface Prioridad {
  valor: number | null;
  recomendacion: Recomendacion;
  /** Cada factor que movió el número, para que nunca sea una caja negra. */
  factores: string[];
}

export const ETIQUETA_RECOMENDACION: Record<Recomendacion, string> = {
  postular: "Lista para postular",
  revisar: "Revisar antes",
  descartar: "Conviene descartar",
  "sin-analisis": "Sin análisis",
};

const DIA = 86_400_000;
const DIAS_VIGENCIA = 14;

export function prioridadDeResumen(r: ResumenAnalisis, diasGuardada = 0): Prioridad {
  if (r.score === null) {
    return { valor: null, recomendacion: "sin-analisis", factores: ["No detectamos habilidades reconocibles en la oferta."] };
  }
  let v = r.score;
  const factores = [`Afinidad ${r.score}%`];

  if (r.alertas.alta > 0) {
    v -= 40;
    factores.push(`${r.alertas.alta} señal${r.alertas.alta === 1 ? "" : "es"} grave${r.alertas.alta === 1 ? "" : "s"} en la oferta (−40)`);
  }
  const penMedia = Math.min(15, r.alertas.media * 5);
  if (penMedia > 0) {
    v -= penMedia;
    factores.push(`${r.alertas.media} señal${r.alertas.media === 1 ? "" : "es"} de precaución (−${penMedia})`);
  }
  if (diasGuardada >= DIAS_VIGENCIA) {
    v -= 5;
    factores.push(`Guardada hace ${diasGuardada} días: la vacante pudo haberse cerrado (−5)`);
  }

  const valor = Math.max(0, Math.min(100, Math.round(v)));
  let recomendacion: Recomendacion = "revisar";
  if (r.alertas.alta > 0 || valor < 25) recomendacion = "descartar";
  else if (valor >= 70 && r.riesgo === "limpia") recomendacion = "postular";
  return { valor, recomendacion, factores };
}

export function prioridad(p: Postulacion, ahora: Date): Prioridad {
  const r = p.oferta?.resumen;
  if (!r) return { valor: null, recomendacion: "sin-analisis", factores: ["Aún no hay una oferta analizada contra tu CV."] };
  const dias = p.estado === "guardada" ? Math.floor((ahora.getTime() - new Date(p.creadaEn).getTime()) / DIA) : 0;
  return prioridadDeResumen(r, Math.max(0, dias));
}

/** Guardadas ordenadas: primero las más convenientes; sin análisis al final. */
export function ordenarPorPrioridad(lista: Postulacion[], ahora: Date): { postulacion: Postulacion; prioridad: Prioridad }[] {
  return lista
    .map((postulacion) => ({ postulacion, prioridad: prioridad(postulacion, ahora) }))
    .sort((a, b) => (b.prioridad.valor ?? -1) - (a.prioridad.valor ?? -1));
}
