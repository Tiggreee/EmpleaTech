import { prep } from "../analisis/texto";
import { claveDePostulacion, clavesDeVacante } from "../autollenado/url";
import type { Postulacion } from "../seguimiento/seguimiento";
import { INFO_FUENTES } from "../vacantes/fuentes";
import type { Vacante } from "../vacantes/vacante";

/**
 * Qué te está funcionando: tasa de entrevistas por plataforma, nivel del puesto, modalidad, versión de CV y afinidad.
 * Con pocos datos no se concluye nada: las tasas se suavizan hacia tu promedio y no hay recomendaciones hasta juntar
 * suficiente evidencia.
 */

export const DIMENSIONES = ["fuente", "nivel", "modalidad", "cv", "afinidad"] as const;
export type Dimension = (typeof DIMENSIONES)[number];

export const NOMBRE_DIMENSION: Record<Dimension, string> = {
  fuente: "Plataforma",
  nivel: "Nivel del puesto",
  modalidad: "Modalidad",
  cv: "Versión de CV",
  afinidad: "Afinidad con tu CV",
};

/** Postulaciones enviadas antes de sacar conclusiones, y mínimo por grupo para opinar de él. */
export const MIN_TOTAL = 20;
export const MIN_GRUPO = 5;
/** Peso del promedio al suavizar: un grupo con 2 de 2 no es «100%». */
const K_SUAVIZADO = 5;

export interface Registro {
  id: string;
  postuladaEn: string;
  entrevista: boolean;
  oferta: boolean;
  /** Días de la postulación a la entrevista (primera respuesta positiva). */
  diasARespuesta?: number;
  dim: Record<Dimension, string>;
}

export interface Grupo {
  valor: string;
  n: number;
  entrevistas: number;
  tasa: number;
  /** Tasa ajustada hacia tu promedio según cuántos datos hay. */
  suavizada: number;
  /** Intervalo de confianza del 95 % (Wilson). */
  bajo: number;
  alto: number;
  pocosDatos: boolean;
}

export interface Recomendacion {
  tono: "ok" | "atencion";
  texto: string;
}

export interface Aprendizaje {
  total: number;
  entrevistas: number;
  ofertas: number;
  tasa: number | null;
  diasPromedioRespuesta: number | null;
  ultimos7: number;
  suficiente: boolean;
  porDimension: Record<Dimension, Grupo[]>;
  recomendaciones: Recomendacion[];
}

// ---------------------------------------------------------------------------------------------------------------
// Registros

const DIA = 86_400_000;

export function nivelDeTitulo(titulo: string): string {
  const t = prep(titulo).folded;
  if (/\b(head|director|directora|vp|lead|lider|principal|staff|gerente|jefe|jefa)\b/.test(t)) return "Líder";
  if (/\b(senior|sr|ssr|semi ?senior|iii)\b/.test(t)) return "Senior";
  if (/\b(junior|jr|intern|internship|trainee|practicante|becari[oa]|entry)\b/.test(t)) return "Entrada";
  return "Medio";
}

function afinidad(score: number | undefined): string {
  if (score === undefined) return "Sin análisis";
  if (score >= 80) return "80 o más";
  if (score >= 60) return "60 a 79";
  if (score >= 40) return "40 a 59";
  return "Menos de 40";
}

const MODALIDAD: Record<string, string> = { remoto: "Remoto", hibrido: "Híbrido", presencial: "Presencial" };

/** Una fila por postulación enviada, con las características de su vacante (si vino de una búsqueda). */
export function registrosDe(postulaciones: Postulacion[], vacantes: Vacante[], nombresCv: Record<string, string>): Registro[] {
  const porClave = new Map<string, Vacante>();
  for (const v of vacantes) for (const c of clavesDeVacante(v)) porClave.set(c, v);
  return postulaciones
    .filter((p): p is Postulacion & { postuladaEn: string } => !!p.postuladaEn)
    .map((p) => {
      const clave = claveDePostulacion(p.url);
      const v = clave ? porClave.get(clave) : undefined;
      const alcanzo = (e: string) => p.historial.some((h) => h.estado === e);
      const primera = p.historial.find((h) => h.estado === "entrevista" || h.estado === "oferta");
      return {
        id: p.id,
        postuladaEn: p.postuladaEn,
        entrevista: alcanzo("entrevista") || alcanzo("oferta"),
        oferta: alcanzo("oferta"),
        diasARespuesta: primera ? Math.max(0, Math.round((new Date(primera.en).getTime() - new Date(p.postuladaEn).getTime()) / DIA)) : undefined,
        dim: {
          fuente: v ? INFO_FUENTES[v.fuente].nombre : "Por tu cuenta",
          nivel: nivelDeTitulo(p.puesto),
          modalidad: v?.modalidad ? MODALIDAD[v.modalidad] : "Sin dato",
          cv: (p.oferta?.cvId && nombresCv[p.oferta.cvId]) || "Sin CV asociado",
          afinidad: afinidad(p.score),
        },
      };
    });
}

// ---------------------------------------------------------------------------------------------------------------
// Estadística

/** Intervalo de Wilson al 95 %: honesto con muestras chicas (2 de 2 no es «seguro 100%»). */
export function wilson(exitos: number, n: number): [number, number] {
  if (!n) return [0, 1];
  const z = 1.96;
  const p = exitos / n;
  const d = 1 + (z * z) / n;
  const centro = (p + (z * z) / (2 * n)) / d;
  const margen = (z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n))) / d;
  return [Math.max(0, centro - margen), Math.min(1, centro + margen)];
}

export function agrupar(registros: Registro[], dim: Dimension, tasaGlobal: number): Grupo[] {
  const grupos = new Map<string, { n: number; e: number }>();
  for (const r of registros) {
    const g = grupos.get(r.dim[dim]) ?? { n: 0, e: 0 };
    g.n++;
    if (r.entrevista) g.e++;
    grupos.set(r.dim[dim], g);
  }
  return [...grupos.entries()]
    .map(([valor, { n, e }]) => {
      const [bajo, alto] = wilson(e, n);
      return { valor, n, entrevistas: e, tasa: e / n, suavizada: (e + K_SUAVIZADO * tasaGlobal) / (n + K_SUAVIZADO), bajo, alto, pocosDatos: n < MIN_GRUPO };
    })
    .sort((a, b) => b.suavizada - a.suavizada || b.n - a.n);
}

const pct = (x: number) => `${Math.round(x * 100)}%`;

/** Diferencia que vale la pena señalar: al menos la mitad de tu tasa (o 3 puntos si tu tasa es muy baja). */
function diferenciaRelevante(g: Grupo, global: number): number {
  const umbral = Math.max(0.03, global * 0.5);
  return Math.abs(g.suavizada - global) >= umbral ? g.suavizada - global : 0;
}

export function aprender(registros: Registro[], ahora: Date): Aprendizaje {
  const total = registros.length;
  const entrevistas = registros.filter((r) => r.entrevista).length;
  const ofertas = registros.filter((r) => r.oferta).length;
  const tasa = total ? entrevistas / total : null;
  const dias = registros.map((r) => r.diasARespuesta).filter((d): d is number => d !== undefined);
  const suficiente = total >= MIN_TOTAL;
  const global = tasa ?? 0;
  const porDimension = Object.fromEntries(DIMENSIONES.map((d) => [d, agrupar(registros, d, global)])) as Record<Dimension, Grupo[]>;

  const recomendaciones: Recomendacion[] = [];
  if (!suficiente) {
    recomendaciones.push({
      tono: "atencion",
      texto: `Llevas ${total} postulación${total === 1 ? "" : "es"} enviada${total === 1 ? "" : "s"}. Con ${MIN_TOTAL} empezamos a ver qué te funciona; marca en Postulaciones cuando te llamen a entrevista.`,
    });
  } else {
    for (const d of ["fuente", "nivel", "modalidad", "cv"] as const) {
      for (const g of porDimension[d]) {
        if (g.pocosDatos) continue;
        const dif = diferenciaRelevante(g, global);
        if (dif > 0) recomendaciones.push({ tono: "ok", texto: `${NOMBRE_DIMENSION[d]} «${g.valor}»: ${pct(g.tasa)} de entrevistas en ${g.n} (tu promedio es ${pct(global)}). Conviene darle prioridad.` });
        else if (dif < 0) recomendaciones.push({ tono: "atencion", texto: `${NOMBRE_DIMENSION[d]} «${g.valor}»: ${pct(g.tasa)} de entrevistas en ${g.n}, por debajo de tu ${pct(global)}. Conviene bajarle o revisar qué cambia ahí.` });
      }
    }
    const alta = porDimension.afinidad.find((g) => g.valor === "80 o más");
    const baja = porDimension.afinidad.find((g) => g.valor === "Menos de 40");
    if (alta && baja && !alta.pocosDatos && !baja.pocosDatos && alta.tasa > baja.tasa) {
      recomendaciones.push({ tono: "ok", texto: `Las vacantes con afinidad alta te responden ${pct(alta.tasa)} contra ${pct(baja.tasa)} de las de afinidad baja: vale más enviar menos y mejor elegidas.` });
    }
    if (!recomendaciones.length) recomendaciones.push({ tono: "ok", texto: "Por ahora ningún grupo se separa claramente de tu promedio. Sigue enviando: con más datos aparecen las diferencias." });
  }

  return {
    total,
    entrevistas,
    ofertas,
    tasa,
    diasPromedioRespuesta: dias.length ? Math.round((dias.reduce((a, b) => a + b, 0) / dias.length) * 10) / 10 : null,
    ultimos7: registros.filter((r) => ahora.getTime() - new Date(r.postuladaEn).getTime() < 7 * DIA).length,
    suficiente,
    porDimension,
    recomendaciones,
  };
}

// ---------------------------------------------------------------------------------------------------------------
// De vuelta al ranking

const TOPE_AJUSTE = 10;

/**
 * Cuánto mover la prioridad de una vacante nueva según lo aprendido de su plataforma y su nivel. Acotado a ±10 y solo
 * con datos suficientes: el aprendizaje afina el orden, no lo decide.
 */
export function ajustePorAprendizaje(a: Aprendizaje, v: Pick<Vacante, "fuente" | "titulo">): { puntos: number; motivo: string } | null {
  if (!a.suficiente || !a.tasa) return null;
  const global = a.tasa;
  const partes: { puntos: number; texto: string }[] = [];
  const revisar = (d: Dimension, valor: string) => {
    const g = a.porDimension[d].find((x) => x.valor === valor);
    if (!g || g.pocosDatos || !diferenciaRelevante(g, global)) return;
    const puntos = Math.max(-TOPE_AJUSTE, Math.min(TOPE_AJUSTE, Math.round(((g.suavizada - global) / Math.max(global, 0.02)) * 5)));
    if (puntos) partes.push({ puntos, texto: `${valor} ${puntos > 0 ? "te responde más" : "te responde menos"}` });
  };
  revisar("fuente", INFO_FUENTES[v.fuente].nombre);
  revisar("nivel", nivelDeTitulo(v.titulo));
  if (!partes.length) return null;
  const puntos = Math.max(-TOPE_AJUSTE, Math.min(TOPE_AJUSTE, partes.reduce((s, p) => s + p.puntos, 0)));
  return { puntos, motivo: `Según tus resultados: ${partes.map((p) => p.texto).join(" y ")} (${puntos > 0 ? "+" : "−"}${Math.abs(puntos)})` };
}

/** Huella del aprendizaje para el re-puntaje: cambia solo cuando cambian los ajustes que produce. */
export function huellaAprendizaje(a: Aprendizaje): string {
  if (!a.suficiente) return "sin-datos";
  return (["fuente", "nivel"] as const).map((d) => a.porDimension[d].map((g) => `${g.valor}:${Math.round(g.suavizada * 100)}`).join(",")).join("|");
}
