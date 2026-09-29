import { prep } from "../analisis/texto";
import type { Estudio } from "../perfil/estructurado";

/** Niveles de estudio que preguntan los formularios, de menor a mayor. */
export type NivelEstudios = "preparatoria" | "tecnico" | "licenciatura" | "maestria" | "doctorado";
export const ORDEN_NIVELES: NivelEstudios[] = ["preparatoria", "tecnico", "licenciatura", "maestria", "doctorado"];

export interface EstudiosForm {
  nivel: NivelEstudios;
  escuela?: string;
  carrera?: string;
  /** Año en que terminaste («2013»). */
  anioFin?: string;
}

/** Sobre texto plegado y sin signos: «B.A.» → «b a». El orden va del nivel más alto al más bajo. */
const PATRONES: [NivelEstudios, RegExp][] = [
  ["doctorado", /\b(ph ?d|doctor(ado|ate|al)?|dphil)\b/],
  ["maestria", /\b(masters?|maestria|magister|mba|msc|m sc|m s|m a|meng|m eng)\b/],
  ["licenciatura", /\b(bachelors?|licenciatura|licenciad[oa]|ingenieria|bsc|b sc|b s|b a|ba|bs|beng|b eng|grado en|undergraduate)\b/],
  ["tecnico", /\b(associate|tsu|tecnico superior|tecnologo)\b/],
  ["preparatoria", /\b(high school|preparatoria|bachillerato|ged)\b/],
];

const limpio = (s: string) =>
  prep(s)
    .folded.replace(/[^a-z0-9]+/g, " ")
    .trim();

/** Nivel de un estudio por su tipo y su área. Un bootcamp, curso o programa no es un título: no tiene nivel. */
export function nivelDeEstudio(e: Pick<Estudio, "studyType" | "area">): NivelEstudios | undefined {
  const texto = limpio(`${e.studyType ?? ""} ${e.area ?? ""}`);
  if (!texto) return undefined;
  return PATRONES.find(([, re]) => re.test(texto))?.[0];
}

/** ¿Ya lo terminaste? Con fecha de inicio y sin fecha de fin (o con fin en el futuro), sigue en curso. */
function terminado(e: Estudio, hoy: Date): boolean {
  if (e.endDate) return e.endDate.slice(0, 7) <= hoy.toISOString().slice(0, 7);
  return !e.startDate;
}

/**
 * Tu estudio terminado de mayor nivel: lo que contesta «highest level of education», «school» y «field of study».
 * Si hay dos del mismo nivel, el más reciente.
 */
export function estudioMasAlto(educacion: Estudio[], hoy: Date): EstudiosForm | undefined {
  const candidatos = educacion
    .filter((e) => terminado(e, hoy))
    .map((e) => ({ e, nivel: nivelDeEstudio(e) }))
    .filter((x): x is { e: Estudio; nivel: NivelEstudios } => !!x.nivel)
    .sort((a, b) => ORDEN_NIVELES.indexOf(b.nivel) - ORDEN_NIVELES.indexOf(a.nivel) || (b.e.endDate ?? "").localeCompare(a.e.endDate ?? ""));
  const mejor = candidatos[0];
  if (!mejor) return undefined;
  const { e, nivel } = mejor;
  return {
    nivel,
    escuela: e.institution?.trim() || undefined,
    carrera: e.area?.trim() || undefined,
    anioFin: e.endDate?.slice(0, 4),
  };
}

export const NOMBRE_NIVEL: Record<"es" | "en", Record<NivelEstudios, string>> = {
  es: { preparatoria: "Preparatoria", tecnico: "Técnico superior universitario", licenciatura: "Licenciatura", maestria: "Maestría", doctorado: "Doctorado" },
  en: { preparatoria: "High school", tecnico: "Associate degree", licenciatura: "Bachelor's degree", maestria: "Master's degree", doctorado: "Doctorate" },
};

/** Opciones de un select o radio que corresponden a cada nivel («Bachelor's Degree», «Licenciatura», «B.S.»…). */
const OPCION_NIVEL: Record<NivelEstudios, RegExp> = {
  doctorado: /\b(doctor\w*|ph ?d)\b/,
  maestria: /\b(masters?|maestria|mba|postgrad\w*|posgrado|graduate degree)\b/,
  licenciatura: /\b(bachelors?|licenciatura|undergraduate|university degree|grado universitario|college degree|b a|b s|bsc)\b/,
  tecnico: /\b(associate|tecnico|tsu|technical)\b/,
  preparatoria: /\b(high school|secondary|preparatoria|bachillerato|ged)\b/,
};

/** Índice de la opción que corresponde a tu nivel; -1 si ninguna es clara. «Some college» o «Bachelor's (in progress)» no cuentan. */
export function opcionDeNivel(nivel: NivelEstudios, opciones: string[]): number {
  return opciones.findIndex((o) => {
    const t = limpio(o);
    return OPCION_NIVEL[nivel].test(t) && !/\b(some|in progress|en curso|trunca|incomplet\w*|sin titulo|without)\b/.test(t);
  });
}

/**
 * Nivel que exige una pregunta de sí/no («Do you have a bachelor's degree?»). undefined si pide una carrera en
 * particular («degree in Computer Science or related field»): eso se deja para ti.
 */
export function nivelQuePide(etiqueta: string): NivelEstudios | undefined {
  const t = limpio(etiqueta);
  if (/\b(in|en)\s+(a\s+)?(computer|comput\w*|informatic\w*|sistemas|software|engineering|ingenier\w*|math\w*|matemat\w*|stem|science|ciencias|related|relevant|afin)\b|\brelated field\b|\bcampo afin\b/.test(t)) return undefined;
  if (/\b(doctor\w*|ph ?d)\b/.test(t)) return "doctorado";
  if (/\b(masters?|maestria|mba|graduate degree|posgrado)\b/.test(t)) return "maestria";
  if (/\b(bachelors?|licenciatura|university degree|college degree|degree|titulo universitario|titulo)\b/.test(t)) return "licenciatura";
  if (/\b(associate|tecnico)\b/.test(t)) return "tecnico";
  if (/\b(high school|diploma|preparatoria|bachillerato|ged)\b/.test(t)) return "preparatoria";
  return undefined;
}

export const cumpleNivel = (tienes: NivelEstudios, pide: NivelEstudios) => ORDEN_NIVELES.indexOf(tienes) >= ORDEN_NIVELES.indexOf(pide);
