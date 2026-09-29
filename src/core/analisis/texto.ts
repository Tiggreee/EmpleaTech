export interface Prepared {
  /** Texto original normalizado a NFC (para citar evidencia). */
  orig: string;
  /** Minúsculas sin acentos, con la MISMA longitud que `orig` (índices alineados). */
  folded: string;
}

function foldChar(c: string): string {
  const base = c.normalize("NFD")[0] ?? c;
  const lower = base.toLowerCase();
  return lower.length === 1 ? lower : c;
}

export function prep(text: string): Prepared {
  const orig = text.normalize("NFC");
  let folded = "";
  for (let i = 0; i < orig.length; i++) folded += foldChar(orig[i]);
  return { orig, folded };
}

export function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function wordCount(text: string): number {
  return (text.match(/[\p{L}\p{N}]+/gu) ?? []).length;
}

const ES_WORDS = new Set(
  "de la el en y con para los las del una por que se un es al lo como mas su nos sus experiencia trabajo equipo empresa buscamos requisitos años anos puesto".split(" "),
);
const EN_WORDS = new Set(
  "the and of to with for in is are you we our will be on as an or this that experience work team company looking requirements years role".split(" "),
);

export type Idioma = "es" | "en" | "mixto";

function contarIdioma(folded: string): { es: number; en: number } {
  let es = 0;
  let en = 0;
  for (const w of folded.match(/[a-z]+/g) ?? []) {
    if (ES_WORDS.has(w)) es++;
    if (EN_WORDS.has(w)) en++;
  }
  return { es, en };
}

export function detectarIdioma(folded: string): Idioma {
  const { es, en } = contarIdioma(folded);
  if (es + en < 8) return "mixto";
  if (es > en * 1.25) return "es";
  if (en > es * 1.25) return "en";
  return "mixto";
}

/**
 * ¿Una frase suelta está escrita en el otro idioma? detectarIdioma pide varias palabras para opinar; una frase corta
 * de un CV («Diseñé una API en Node.js») basta con que se incline al otro idioma para no pegarla sin traducir.
 */
export function enOtroIdioma(texto: string, idioma: "es" | "en"): boolean {
  const { es, en } = contarIdioma(prep(texto).folded);
  return idioma === "en" ? es > en : en > es;
}

export function recortar(s: string, max = 160): string {
  const t = s.replace(/\s+/g, " ").trim();
  return t.length > max ? `${t.slice(0, max - 1).trimEnd()}…` : t;
}
