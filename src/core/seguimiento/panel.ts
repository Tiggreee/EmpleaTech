import { prioridad } from "./prioridad";
import { estadisticas, siguienteAccion, type Postulacion, type Tono } from "./seguimiento";

export interface AccionHoy {
  id: string;
  empresa: string;
  puesto: string;
  texto: string;
  tono: Tono;
}

const ORDEN_TONO: Record<Tono, number> = { urgente: 0, atencion: 1, ok: 2 };

/** Solo lo que exige acción: seguimientos vencidos, cierres, entrevistas y ofertas. */
export function accionesDeHoy(lista: Postulacion[], ahora: Date): AccionHoy[] {
  return lista
    .filter((p) => p.estado === "postulada" || p.estado === "entrevista" || p.estado === "oferta")
    .map((p) => ({ p, a: siguienteAccion(p, ahora) }))
    .filter(({ a }) => a.tono !== "ok")
    .sort((x, y) => ORDEN_TONO[x.a.tono] - ORDEN_TONO[y.a.tono])
    .map(({ p, a }) => ({ id: p.id, empresa: p.empresa, puesto: p.puesto, texto: a.texto, tono: a.tono }));
}

/** Habilidades requeridas que más te faltan en las ofertas que has guardado. */
export function brechasFrecuentes(lista: Postulacion[], limite = 5): { label: string; veces: number }[] {
  const cuenta = new Map<string, number>();
  for (const p of lista) {
    for (const b of p.oferta?.resumen.brechas ?? []) cuenta.set(b, (cuenta.get(b) ?? 0) + 1);
  }
  return [...cuenta.entries()]
    .map(([label, veces]) => ({ label, veces }))
    .sort((a, b) => b.veces - a.veces || a.label.localeCompare(b.label, "es"))
    .slice(0, limite);
}

export interface Insight {
  id: string;
  tono: Tono;
  titulo: string;
  detalle: string;
}

export function generarInsights(lista: Postulacion[], ahora: Date, tieneCv: boolean): Insight[] {
  const out: Insight[] = [];
  const stats = estadisticas(lista, ahora);

  if (!tieneCv) {
    out.push({ id: "sin-cv", tono: "atencion", titulo: "Guarda tu CV para analizar más rápido", detalle: "Con un CV guardado (solo en este navegador) puedes analizar cada oferta en un paso y reanalizar todo si lo mejoras." });
  }

  if (stats.pendientesSeguimiento > 0) {
    out.push({ id: "seguimientos", tono: "urgente", titulo: `${stats.pendientesSeguimiento} seguimiento${stats.pendientesSeguimiento === 1 ? "" : "s"} pendiente${stats.pendientesSeguimiento === 1 ? "" : "s"}`, detalle: "Un mensaje breve a los 7 días suele ser lo que más mueve una postulación estancada." });
  }

  const listas = lista.filter((p) => p.estado === "guardada" && prioridad(p, ahora).recomendacion === "postular").length;
  if (listas > 0) {
    out.push({ id: "listas", tono: "ok", titulo: `${listas} oferta${listas === 1 ? "" : "s"} lista${listas === 1 ? "" : "s"} para postular`, detalle: "Alta afinidad y sin señales de riesgo. Revísalas y postula con el Sello Humano." });
  }

  const paraDescartar = lista.filter((p) => p.estado === "guardada" && prioridad(p, ahora).recomendacion === "descartar").length;
  if (paraDescartar > 0) {
    out.push({ id: "descartar", tono: "atencion", titulo: `${paraDescartar} guardada${paraDescartar === 1 ? "" : "s"} que conviene descartar`, detalle: "Baja afinidad o señales graves en la oferta. Ciérralas para que no te distraigan." });
  }

  const frecuentes = brechasFrecuentes(lista, 3).filter((b) => b.veces >= 2);
  if (frecuentes.length > 0) {
    out.push({
      id: "brechas",
      tono: "atencion",
      titulo: "Tus brechas se repiten",
      detalle: `Te piden ${frecuentes.map((b) => `${b.label} (${b.veces} ofertas)`).join(", ")} y no aparecen en tu CV. Si las dominas, agrégalas; si no, es lo más rentable por aprender.`,
    });
  }

  if (stats.postuladas >= 8 && stats.tasaEntrevista === 0) {
    out.push({ id: "sin-entrevistas", tono: "urgente", titulo: "8 o más postulaciones sin una sola entrevista", detalle: "Revisa que tu CV use las mismas palabras que las ofertas y que estés postulando a puestos con afinidad alta." });
  }

  const conScore = lista.filter((p) => p.postuladaEn && p.score !== undefined);
  if (conScore.length >= 5) {
    const media = conScore.reduce((a, p) => a + (p.score ?? 0), 0) / conScore.length;
    if (media < 50) {
      out.push({ id: "baja-afinidad", tono: "atencion", titulo: "Estás postulando a ofertas de baja afinidad", detalle: `Tu afinidad media al postular es ${Math.round(media)}%. Priorizar ofertas de 70% o más suele rendir mejor.` });
    }
  }
  return out;
}
