import { detectarIdioma, prep, recortar, wordCount, type Idioma } from "./texto";
import { SKILLS, findMentions, type Categoria, type Skill } from "./habilidades";

export type Nivel = "requerida" | "funcion" | "deseable";
export type Estado = "cubierta" | "transferible" | "faltante";

const PESO: Record<Nivel, number> = { requerida: 3, funcion: 2, deseable: 1 };
const CREDITO_TRANSFERIBLE = 0.4;
const PESO_EXPERIENCIA = 0.2;

export interface Hallazgo {
  id: string;
  label: string;
  cat: Categoria;
  nivel: Nivel;
  menciones: number;
  peso: number;
  estado: Estado;
  /** Habilidad del CV que da el crédito transferible. */
  via?: string;
  /** Frase de la oferta donde se pide. */
  enOferta: string;
  /** Fragmento del CV que lo respalda. */
  enCv?: string;
}

export interface Experiencia {
  aniosPedidos: number;
  aniosCv: number | null;
  fuente: "declarada" | "estimada" | "ninguna";
  aniosEstimados: number | null;
  /** Solo se puntúa cuando el CV lo declara de forma explícita. */
  puntuada: boolean;
}

export interface Resultado {
  score: number | null;
  veredicto: string;
  idiomaOferta: Idioma;
  idiomaCv: Idioma;
  hallazgos: Hallazgo[];
  desglose: Record<Nivel, { cubiertas: number; total: number }>;
  experiencia: Experiencia | null;
  razones: string[];
  brechas: string[];
  sugerencias: string[];
  avisos: string[];
}

type Modo = Nivel | "ignorar";

const HEAD_IGNORAR = /^(?:acerca de|sobre nosotros|quienes somos|about (?:us|the company)|who we are|beneficios|benefits|we offer|ofrecemos|que ofrecemos|te ofrecemos|lo que te ofrecemos|what we offer|perks|nuestra mision|nuestros valores|our (?:values|mission))\b/;
/**
 * Encabezados comunes en bolsas de México y LatAm («Escolaridad:», «Conocimientos:», «Prestaciones:»). Solo cuentan
 * si son la etiqueta completa: «Conocimientos en Excel» o «Prestaciones de ley y cálculo de finiquitos» son contenido.
 */
const HEAD_IGNORAR_EXACTO = /^(?:prestaciones(?: de ley| superiores(?: a las? de ley)?)?|sueldo y prestaciones|compensacion y beneficios)$/;
const HEAD_REQ_EXACTO = /^(?:escolaridad|conocimientos(?: tecnicos| requeridos| indispensables)?|competencias(?: requeridas)?|habilidades(?: requeridas| tecnicas)?|experiencia(?: requerida| laboral| necesaria)?|idiomas?)$/;
const HEAD_DESEABLE_EXACTO = /^(?:conocimientos|habilidades|experiencia) (?:deseables?|adicionales)$/;
const HEAD_REQ = /^(?:requisitos|requerimientos|requirements|must[- ]haves?|lo que buscamos|lo que necesitas|what you(?:'|’)?ll need|what we(?:'|’)?re looking for|qualifications|minimum qualifications|perfil|te buscamos|you have|indispensable|obligatorio)\b/;
const HEAD_DESEABLE = /^(?:deseable|deseables|valorable|se valorara|nice[- ]to[- ]haves?|bonus|preferred(?: qualifications)?|preferido|plus|adicional|opcional)\b/;
const HEAD_FUNCION = /^(?:responsabilidades|funciones|actividades|tu dia a dia|lo que haras|responsibilities|what you(?:'|’)?ll do|the role|duties|key responsibilities|day[- ]to[- ]day)\b/;
const LINEA_DESEABLE = /\b(?:nice to have|is a plus|as a plus|a plus|es un plus|un plus|deseable|se valora|valorable|preferably|preferentemente|bonus points?)\b/;

function modoDeTitulo(foldedLine: string): Modo | null {
  const t = foldedLine.replace(/^[\s\-•*#>·▪–—\d.)]+/, "").replace(/[:：\s]+$/, "");
  if (t.length === 0 || t.length > 70) return null;
  if (HEAD_IGNORAR.test(t) || HEAD_IGNORAR_EXACTO.test(t)) return "ignorar";
  if (HEAD_DESEABLE.test(t) || HEAD_DESEABLE_EXACTO.test(t)) return "deseable";
  if (HEAD_FUNCION.test(t)) return "funcion";
  if (HEAD_REQ.test(t) || HEAD_REQ_EXACTO.test(t)) return "requerida";
  return null;
}

/** «Requisitos: inglés avanzado» → etiqueta y contenido en la misma línea. null si la línea no empieza con una etiqueta. */
function etiquetaEnLinea(fLinea: string): { modo: Modo; desde: number } | null {
  const dosPuntos = fLinea.search(/[:：]/);
  if (dosPuntos <= 0 || !fLinea.slice(dosPuntos + 1).trim()) return null;
  const modo = modoDeTitulo(fLinea.slice(0, dosPuntos));
  return modo ? { modo, desde: dosPuntos + 1 } : null;
}

interface Frase {
  orig: string;
  folded: string;
  nivel: Modo;
}

function segmentarOferta(texto: string): Frase[] {
  const { orig, folded } = prep(texto);
  const out: Frase[] = [];
  let modo: Modo = "requerida";
  let offset = 0;
  for (const linea of orig.split(/\r?\n/)) {
    const fLinea = folded.slice(offset, offset + linea.length);
    offset += linea.length + (orig[offset + linea.length] === "\r" ? 2 : 1);
    if (!linea.trim()) continue;
    // Una etiqueta abre sección igual que un título («Beneficios: te ofrecemos lo siguiente» y sus viñetas), pero además
    // se analiza el texto que trae después de los dos puntos.
    const enLinea = etiquetaEnLinea(fLinea);
    const titulo = enLinea ? null : modoDeTitulo(fLinea);
    if (titulo) {
      modo = titulo;
      continue;
    }
    if (enLinea) modo = enLinea.modo;
    const modoLinea = modo;
    const desde = enLinea?.desde ?? 0;
    const contenido = linea.slice(desde);
    let pos = 0;
    for (const trozo of contenido.split(/(?<=[.!?;])\s+/)) {
      const ini = desde + contenido.indexOf(trozo, pos);
      pos = ini - desde + trozo.length;
      if (!trozo.trim()) continue;
      const f = fLinea.slice(ini, ini + trozo.length);
      const nivel: Modo = modoLinea !== "ignorar" && LINEA_DESEABLE.test(f) ? "deseable" : modoLinea;
      out.push({ orig: trozo, folded: f, nivel });
    }
  }
  return out;
}

interface Requerimiento {
  skill: Skill;
  nivel: Nivel;
  menciones: number;
  enOferta: string;
}

function extraerRequerimientos(frases: Frase[]): Requerimiento[] {
  const mapa = new Map<string, Requerimiento>();
  for (const fr of frases) {
    if (fr.nivel === "ignorar") continue;
    for (const skill of SKILLS) {
      const n = findMentions(fr.folded, fr.orig, skill).length;
      if (n === 0) continue;
      const prev = mapa.get(skill.id);
      if (!prev) {
        mapa.set(skill.id, { skill, nivel: fr.nivel, menciones: n, enOferta: recortar(fr.orig) });
      } else {
        prev.menciones += n;
        if (PESO[fr.nivel] > PESO[prev.nivel]) {
          prev.nivel = fr.nivel;
          prev.enOferta = recortar(fr.orig);
        }
      }
    }
  }
  return [...mapa.values()];
}

function pesoDe(r: Requerimiento): number {
  return PESO[r.nivel] * (1 + 0.25 * Math.min(r.menciones - 1, 2));
}

function fragmento(orig: string, idx: number): string {
  const ini = Math.max(0, idx - 45);
  const fin = Math.min(orig.length, idx + 75);
  return `${ini > 0 ? "…" : ""}${recortar(orig.slice(ini, fin), 130)}${fin < orig.length ? "…" : ""}`;
}

const RE_ANIOS = /(\d{1,2})\s*\+?\s*(?:o mas\s*)?(?:anos|years|yrs|year)\b/;

function aniosPedidos(frases: Frase[]): number | null {
  const valores: number[] = [];
  for (const fr of frases) {
    if (fr.nivel === "ignorar" || fr.nivel === "deseable") continue;
    if (!/(experiencia|experience|expertise|trayectoria)/.test(fr.folded)) continue;
    const m = RE_ANIOS.exec(fr.folded);
    if (m) {
      const n = Number(m[1]);
      if (n >= 1 && n <= 25) valores.push(n);
    }
  }
  return valores.length ? Math.min(...valores) : null;
}

function aniosDelCv(folded: string, ahora: Date): { declarados: number | null; estimados: number | null } {
  const declarados: number[] = [];
  const pats = [
    /(\d{1,2})\s*\+?\s*(?:anos?|years?|yrs?)\s+(?:de\s+|of\s+|en\s+|in\s+)?(?:experiencia|experience)/g,
    /experiencia\s+(?:de|of)\s+(\d{1,2})\s*\+?\s*(?:anos?|years?)/g,
  ];
  for (const p of pats) for (const m of folded.matchAll(p)) declarados.push(Number(m[1]));
  const validos = declarados.filter((n) => n >= 1 && n <= 50);

  const anioActual = ahora.getFullYear();
  let ini = Infinity;
  let fin = -Infinity;
  const rango = /\b((?:19|20)\d{2})\s*(?:-|–|—|a|to|hasta)\s*((?:19|20)\d{2}|presente|actual|actualidad|present|current|hoy|now)\b/g;
  for (const m of folded.matchAll(rango)) {
    const a = Number(m[1]);
    const b = /^\d/.test(m[2]) ? Number(m[2]) : anioActual;
    if (a <= b && b <= anioActual + 1) {
      ini = Math.min(ini, a);
      fin = Math.max(fin, b);
    }
  }
  const estimados = Number.isFinite(ini) && fin >= ini ? fin - ini : null;
  return { declarados: validos.length ? Math.max(...validos) : null, estimados };
}

function veredicto(score: number | null): string {
  if (score === null) return "Sin datos suficientes";
  if (score >= 80) return "Afinidad alta";
  if (score >= 60) return "Buena afinidad";
  if (score >= 40) return "Afinidad media";
  return "Afinidad baja";
}

export interface Opciones {
  ahora?: Date;
}

export function analizar(cv: string, oferta: string, opciones: Opciones = {}): Resultado {
  const ahora = opciones.ahora ?? new Date();
  const desglose: Resultado["desglose"] = {
    requerida: { cubiertas: 0, total: 0 },
    funcion: { cubiertas: 0, total: 0 },
    deseable: { cubiertas: 0, total: 0 },
  };

  const vacio = (avisos: string[]): Resultado => ({
    score: null,
    veredicto: veredicto(null),
    idiomaOferta: "mixto",
    idiomaCv: "mixto",
    hallazgos: [],
    desglose,
    experiencia: null,
    razones: [],
    brechas: [],
    sugerencias: [],
    avisos,
  });

  if (!cv.trim() || !oferta.trim()) return vacio(["Pega tu CV y la oferta para analizar."]);

  const pCv = prep(cv);
  const frases = segmentarOferta(oferta);
  const reqs = extraerRequerimientos(frases);
  const idiomaOferta = detectarIdioma(prep(oferta).folded);
  const idiomaCv = detectarIdioma(pCv.folded);

  const avisos: string[] = [];
  if (wordCount(oferta) < 40) avisos.push("La oferta es muy corta: el análisis puede ser poco fiable.");
  if (wordCount(cv) < 40) avisos.push("El CV es muy corto: es probable que falten habilidades por detectar.");
  if (idiomaOferta !== "mixto" && idiomaCv !== "mixto" && idiomaOferta !== idiomaCv) {
    avisos.push(
      idiomaOferta === "en"
        ? "La oferta está en inglés y tu CV en español: muchos sistemas de filtrado buscan coincidencias en el mismo idioma. Considera una versión en inglés."
        : "La oferta está en español y tu CV en inglés: considera una versión en español para esta vacante.",
    );
  }

  if (reqs.length === 0) {
    return {
      ...vacio([...avisos, "No detectamos habilidades reconocibles en la oferta. Revisa que pegaste el texto completo."]),
      idiomaOferta,
      idiomaCv,
    };
  }

  const cvPorSkill = new Map<string, number>();
  for (const skill of SKILLS) {
    const pos = findMentions(pCv.folded, pCv.orig, skill);
    if (pos.length) cvPorSkill.set(skill.id, pos[0]);
  }

  const hallazgos: Hallazgo[] = reqs.map((r) => {
    const base = { id: r.skill.id, label: r.skill.label, cat: r.skill.cat, nivel: r.nivel, menciones: r.menciones, peso: pesoDe(r), enOferta: r.enOferta };
    const idx = cvPorSkill.get(r.skill.id);
    if (idx !== undefined) return { ...base, estado: "cubierta" as const, enCv: fragmento(pCv.orig, idx) };
    if (r.skill.family) {
      const primo = SKILLS.find((k) => k.family === r.skill.family && k.id !== r.skill.id && cvPorSkill.has(k.id));
      if (primo) {
        return { ...base, estado: "transferible" as const, via: primo.label, enCv: fragmento(pCv.orig, cvPorSkill.get(primo.id) ?? 0) };
      }
    }
    return { ...base, estado: "faltante" as const };
  });

  hallazgos.sort((a, b) => b.peso - a.peso || a.label.localeCompare(b.label, "es"));

  let total = 0;
  let ganado = 0;
  for (const h of hallazgos) {
    total += h.peso;
    desglose[h.nivel].total++;
    if (h.estado === "cubierta") {
      ganado += h.peso;
      desglose[h.nivel].cubiertas++;
    } else if (h.estado === "transferible") {
      ganado += h.peso * CREDITO_TRANSFERIBLE;
    }
  }
  const pctSkills = ganado / total;

  let experiencia: Experiencia | null = null;
  let pctExp: number | null = null;
  const pedidos = aniosPedidos(frases);
  if (pedidos !== null) {
    const { declarados, estimados } = aniosDelCv(pCv.folded, ahora);
    experiencia = {
      aniosPedidos: pedidos,
      aniosCv: declarados,
      aniosEstimados: estimados,
      fuente: declarados !== null ? "declarada" : estimados !== null ? "estimada" : "ninguna",
      puntuada: declarados !== null,
    };
    if (declarados !== null) pctExp = Math.min(1, declarados / pedidos);
    else if (estimados !== null) {
      avisos.push(
        `La oferta pide ${pedidos}+ años de experiencia. Por las fechas de tu CV estimamos ~${estimados} años; escríbelo explícitamente (p. ej. "${pedidos}+ años de experiencia en…") para que cuente.`,
      );
    } else {
      avisos.push(`La oferta pide ${pedidos}+ años de experiencia y tu CV no los menciona.`);
    }
  }

  const bruto = pctExp === null ? pctSkills : pctSkills * (1 - PESO_EXPERIENCIA) + pctExp * PESO_EXPERIENCIA;
  const score = Math.round(bruto * 100);

  const razones = hallazgos
    .filter((h) => h.estado === "cubierta")
    .slice(0, 3)
    .map((h) => `Cubres «${h.label}» (${nombreNivel(h.nivel)}): ${h.enCv}`);
  const faltantes = hallazgos.filter((h) => h.estado !== "cubierta");
  const brechas = faltantes.slice(0, 3).map((h) =>
    h.estado === "transferible"
      ? `«${h.label}» (${nombreNivel(h.nivel)}): no aparece, pero tu ${h.via} es transferible.`
      : `Falta «${h.label}» (${nombreNivel(h.nivel)}${h.menciones > 1 ? `, mencionada ${h.menciones} veces` : ""}).`,
  );
  const sugerencias = faltantes.slice(0, 5).map((h) =>
    h.estado === "transferible"
      ? `Pides ${h.label}: destaca tu experiencia con ${h.via} y explica cómo la aplicarías aquí.`
      : `Si tienes experiencia real con ${h.label}, añádela con un logro medible (p. ej. «Implementé ${h.label} y reduje X en N%»). Si no la tienes, no la inventes: un mini-proyecto o curso la respalda.`,
  );

  return {
    score,
    veredicto: veredicto(score),
    idiomaOferta,
    idiomaCv,
    hallazgos,
    desglose,
    experiencia,
    razones,
    brechas,
    sugerencias,
    avisos,
  };
}

export function nombreNivel(n: Nivel): string {
  return n === "requerida" ? "requerida" : n === "funcion" ? "función del puesto" : "deseable";
}

export interface HabilidadDetectada {
  id: string;
  label: string;
  cat: Categoria;
  menciones: number;
}

/** Lo que entiende la app de un texto (CV u oferta), agrupable por categoría. */
export function detectarHabilidades(texto: string): HabilidadDetectada[] {
  const { folded, orig } = prep(texto);
  const out: HabilidadDetectada[] = [];
  for (const skill of SKILLS) {
    const n = findMentions(folded, orig, skill).length;
    if (n > 0) out.push({ id: skill.id, label: skill.label, cat: skill.cat, menciones: n });
  }
  return out.sort((a, b) => b.menciones - a.menciones || a.label.localeCompare(b.label, "es"));
}
