/**
 * Propuestas en plataformas freelance (Workana, Upwork, Freelancer.com): leer el proyecto que tienes abierto y poner la
 * propuesta en su cuadro. Solo cuando tú lo pides, en la página que tú abriste; nunca envía nada.
 */
import { asignarValor, etiquetaDe } from "./dom";

export type PlataformaPropuesta = "workana" | "upwork" | "freelancer";

const DOMINIOS: [RegExp, PlataformaPropuesta][] = [
  [/(^|\.)workana\.com$/, "workana"],
  [/(^|\.)upwork\.com$/, "upwork"],
  [/(^|\.)freelancer\.com$/, "freelancer"],
];

/** Páginas de un proyecto o de su formulario de propuesta (no la portada, búsquedas ni tu bandeja). */
const PAGINAS: Record<PlataformaPropuesta, RegExp> = {
  workana: /^\/(job|jobs\/[^/]+|messages\/bid)\//,
  upwork: /^\/(jobs|freelance-jobs\/apply|nx\/proposals|ab\/proposals)\//,
  freelancer: /^\/projects\/[^/]+\/[^/]+/,
};

export function plataformaDeUrl(url: string): PlataformaPropuesta | null {
  try {
    const host = new URL(url).hostname.toLowerCase();
    return DOMINIOS.find(([re]) => re.test(host))?.[1] ?? null;
  } catch {
    return null;
  }
}

export function esPaginaDeProyecto(url: string): boolean {
  const p = plataformaDeUrl(url);
  if (!p) return false;
  return PAGINAS[p].test(new URL(url).pathname);
}

const RUIDO = "script, style, noscript, nav, header, footer, aside, form, [role='navigation'], [role='banner'], [role='contentinfo'], [aria-hidden='true']";
const MAX_TEXTO = 12_000;

const plano = (s: string | null | undefined) => (s ?? "").replace(/\s+/g, " ").trim();

/** Título y descripción del proyecto: el encabezado principal y el contenido sin menús, pies ni formularios. */
export function leerProyecto(doc: Document): { titulo: string; texto: string } {
  const titulo = plano(doc.querySelector("h1")?.textContent) || plano(doc.title).replace(/\s*[|–—-]\s*(Upwork|Workana|Freelancer(\.com)?)\b.*$/i, "");
  const raiz = doc.querySelector("main, [role='main'], article") ?? doc.body;
  if (!raiz) return { titulo, texto: "" };
  const copia = raiz.cloneNode(true) as Element;
  for (const el of Array.from(copia.querySelectorAll(RUIDO))) el.remove();
  return { titulo: titulo.slice(0, 300), texto: plano(copia.textContent).slice(0, MAX_TEXTO) };
}

const ES_PROPUESTA = /(cover letter|proposal|propuesta|carta|bid|describe your|message|mensaje|why (you|are you)|por que (tu|eres))/i;

function usable(el: HTMLTextAreaElement): boolean {
  return !el.disabled && !el.readOnly && !el.hidden && !el.closest("[hidden], [aria-hidden='true']") && el.style.display !== "none";
}

/** El cuadro donde va la propuesta: el que dice «cover letter / propuesta / mensaje»; si hay uno solo, ese. */
export function campoDePropuesta(doc: Document): HTMLTextAreaElement | null {
  const cuadros = Array.from(doc.querySelectorAll("textarea")).filter(usable);
  const pistas = (el: HTMLTextAreaElement) => [etiquetaDe(el), el.placeholder, el.name, el.id, el.getAttribute("aria-label")].filter(Boolean).join(" ");
  return cuadros.find((el) => ES_PROPUESTA.test(pistas(el))) ?? (cuadros.length === 1 ? cuadros[0] : null);
}

/** Recorta en la última oración completa que cabe en el máximo del cuadro. */
export function recortarA(texto: string, max: number): string {
  if (!max || max <= 0 || texto.length <= max) return texto;
  const corte = texto.slice(0, max);
  const fin = Math.max(corte.lastIndexOf(". "), corte.lastIndexOf("\n"), corte.lastIndexOf("? "));
  // Una propuesta cortada a media frase se ve peor que una más corta: se corta en la última oración salvo que quede casi nada.
  return (fin > max * 0.3 ? corte.slice(0, fin + 1) : corte).trimEnd();
}

/** Pone la propuesta en su cuadro. Si ya escribiste algo, no lo toca. */
export function llenarPropuesta(el: HTMLTextAreaElement, texto: string): "llenado" | "ya-tenia" {
  if (el.value.trim()) return "ya-tenia";
  asignarValor(el, recortarA(texto, el.maxLength));
  return "llenado";
}
