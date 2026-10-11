import { prep } from "../analisis/texto";
import type { PerfilJson } from "./estructurado";
import type { NivelIngles, Respuestas } from "./respuestas";

function aMes(fecha: string): number {
  const [a, m] = fecha.split("-").map(Number);
  return a * 12 + ((m || 1) - 1);
}

/** Años de experiencia según los puestos del CV, sin contar dos veces los que se traslapan; sin fechas, undefined. */
export function aniosDelCv(p: PerfilJson, ahora: Date): number | undefined {
  const hoy = ahora.getUTCFullYear() * 12 + ahora.getUTCMonth();
  const rangos = p.work
    .filter((w) => w.startDate)
    .map((w) => [aMes(w.startDate as string), w.endDate ? aMes(w.endDate) + (w.endDate.length === 4 ? 11 : 0) : hoy] as const)
    .filter(([a, b]) => b >= a)
    .sort((x, y) => x[0] - y[0]);
  if (!rangos.length) return undefined;
  let total = 0;
  let [ini, fin] = rangos[0];
  for (const [a, b] of rangos.slice(1)) {
    if (a <= fin) fin = Math.max(fin, b);
    else {
      total += fin - ini;
      [ini, fin] = [a, b];
    }
  }
  total += fin - ini;
  return Math.floor(total / 12);
}

/** El primero que coincide gana: «intermedio alto» es intermedio; «professional working», avanzado. */
const NIVELES: [RegExp, NivelIngles][] = [
  [/\b(nativ[oa]|native|lengua materna|mother tongue|bilingue|bilingual|c2)\b/, "nativo"],
  [/\b(avanzado|advanced|fluido|fluent|profesional|professional|c1)\b/, "avanzado"],
  [/\b(intermedio|intermediate|conversacional|conversational|b[12])\b/, "intermedio"],
  [/\b(basico|basic|elemental|a[12])\b/, "basico"],
];

/** Nivel de inglés que escribiste en el CV («Inglés — B2», «English: fluent»). Si el CV no dice el nivel, no se adivina. */
export function inglesDelCv(p: PerfilJson): NivelIngles | undefined {
  const fluidez = p.languages.find((l) => /^(ingles|english)$/.test(prep(l.language).folded.trim()))?.fluency;
  if (!fluidez) return undefined;
  const t = prep(fluidez).folded;
  return NIVELES.find(([re]) => re.test(t))?.[1];
}

/**
 * Tus respuestas, completadas con lo que tu CV ya dice cuando no las contestaste: años de experiencia y nivel de
 * inglés. Lo que contestaste a mano siempre manda. Sirve para ordenar vacantes y llenar formularios; los documentos no
 * lo usan (solo afirman los años que tú declaraste). El país no se toma de aquí: vivir en un país no es lo mismo que
 * estar autorizado para trabajar en él, y eso solo lo declaras tú.
 */
export function respuestasConElCv(r: Respuestas, p: PerfilJson | undefined, ahora: Date): Respuestas {
  if (!p) return r;
  const anios = r.aniosExperiencia ?? aniosDelCv(p, ahora);
  const ingles = r.nivelIngles ?? inglesDelCv(p);
  return { ...r, ...(anios !== undefined ? { aniosExperiencia: anios } : {}), ...(ingles ? { nivelIngles: ingles } : {}) };
}
