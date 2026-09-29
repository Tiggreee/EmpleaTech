import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import type { IdiomaDoc } from "@/core/documentos/aMedida";
import { TITULOS, rangoFechas } from "@/core/documentos/formato";
import type { PerfilJson } from "@/core/perfil/estructurado";

/**
 * PDF con texto real (no imagen), una columna y fuentes estándar: lo que mejor leen los sistemas de reclutamiento.
 * Las fuentes estándar solo cubren WinAnsi, así que los caracteres fuera de ese juego se aproximan.
 */

const WINANSI_EXTRA = "€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ";

export function aWinAnsi(s: string): string {
  let out = "";
  for (const c of s.normalize("NFC")) {
    const cp = c.codePointAt(0) ?? 0;
    if ((cp >= 0x20 && cp <= 0x7e) || (cp >= 0xa0 && cp <= 0xff) || WINANSI_EXTRA.includes(c)) out += c;
    else if (c === "\n" || c === "\t") out += " ";
    else {
      const base = c.normalize("NFD").replace(/[̀-ͯ]/g, "");
      out += /^[\x20-\x7e]+$/.test(base) ? base : c === "→" ? "->" : "";
    }
  }
  return out;
}

const MARGEN = 54;
const ANCHO = 612;
const ALTO = 792;

class Escritor {
  private pagina: PDFPage;
  private y = ALTO - MARGEN;

  constructor(
    private readonly doc: PDFDocument,
    private readonly normal: PDFFont,
    private readonly negrita: PDFFont,
  ) {
    this.pagina = doc.addPage([ANCHO, ALTO]);
  }

  private espacio(alto: number) {
    if (this.y - alto < MARGEN) {
      this.pagina = this.doc.addPage([ANCHO, ALTO]);
      this.y = ALTO - MARGEN;
    }
  }

  private lineas(texto: string, fuente: PDFFont, tam: number, ancho: number): string[] {
    const out: string[] = [];
    for (const parrafo of texto.split("\n")) {
      let linea = "";
      for (const palabra of aWinAnsi(parrafo).split(" ").filter(Boolean)) {
        const prueba = linea ? `${linea} ${palabra}` : palabra;
        if (fuente.widthOfTextAtSize(prueba, tam) > ancho && linea) {
          out.push(linea);
          linea = palabra;
        } else linea = prueba;
      }
      out.push(linea);
    }
    return out;
  }

  texto(t: string, { tam = 10, negrita = false, sangria = 0, gris = false, antes = 0 } = {}) {
    if (!t.trim()) return;
    const fuente = negrita ? this.negrita : this.normal;
    const alto = tam * 1.35;
    this.y -= antes;
    for (const l of this.lineas(t, fuente, tam, ANCHO - MARGEN * 2 - sangria)) {
      this.espacio(alto);
      this.pagina.drawText(l, { x: MARGEN + sangria, y: this.y - tam, size: tam, font: fuente, color: gris ? rgb(0.3, 0.3, 0.3) : rgb(0, 0, 0) });
      this.y -= alto;
    }
  }

  vineta(t: string) {
    const tam = 10;
    this.espacio(tam * 1.35);
    this.pagina.drawText("•", { x: MARGEN + 4, y: this.y - tam, size: tam, font: this.normal });
    this.texto(t, { sangria: 14 });
  }

  titulo(t: string) {
    this.espacio(30);
    this.y -= 10;
    this.texto(t.toUpperCase(), { tam: 10.5, negrita: true });
    this.pagina.drawLine({ start: { x: MARGEN, y: this.y + 2 }, end: { x: ANCHO - MARGEN, y: this.y + 2 }, thickness: 0.6, color: rgb(0.75, 0.75, 0.75) });
    this.y -= 4;
  }
}

async function nuevo(titulo: string): Promise<{ doc: PDFDocument; w: Escritor }> {
  const doc = await PDFDocument.create();
  doc.setTitle(aWinAnsi(titulo));
  doc.setCreator("EmpleaTech");
  doc.setProducer("EmpleaTech");
  const [normal, negrita] = await Promise.all([doc.embedFont(StandardFonts.Helvetica), doc.embedFont(StandardFonts.HelveticaBold)]);
  return { doc, w: new Escritor(doc, normal, negrita) };
}

export async function cvAPdf(cv: PerfilJson, idioma: IdiomaDoc): Promise<Uint8Array> {
  const t = TITULOS[idioma];
  const b = cv.basics;
  const { doc, w } = await nuevo(`${b.name || "CV"} - CV`);
  w.texto(b.name || "", { tam: 18, negrita: true });
  if (b.label) w.texto(b.label, { tam: 11 });
  const ubicacion = [b.location?.city, b.location?.region, b.location?.countryCode].filter(Boolean).join(", ");
  w.texto([b.email, b.phone, ubicacion, b.url, ...b.profiles.map((p) => p.url)].filter(Boolean).join("  ·  "), { tam: 9, gris: true, antes: 2 });

  if (b.summary) {
    w.titulo(t.resumen);
    w.texto(b.summary);
  }
  if (cv.work.length) {
    w.titulo(t.experiencia);
    for (const x of cv.work) {
      w.texto([x.position, x.name].filter(Boolean).join(" — "), { negrita: true, antes: 4 });
      w.texto([rangoFechas(x.startDate, x.endDate, idioma), x.location].filter(Boolean).join(" · "), { tam: 9, gris: true });
      if (x.summary) w.texto(x.summary);
      for (const h of x.highlights) w.vineta(h);
    }
  }
  if (cv.education.length) {
    w.titulo(t.educacion);
    for (const e of cv.education) w.texto([[e.studyType, e.area].filter(Boolean).join(" "), e.institution, rangoFechas(e.startDate, e.endDate, idioma)].filter(Boolean).join(" — "));
  }
  if (cv.skills.length) {
    w.titulo(t.habilidades);
    for (const s of cv.skills) w.texto(`${s.name}: ${s.keywords.join(", ")}`);
  }
  if (cv.languages.length) {
    w.titulo(t.idiomas);
    w.texto(cv.languages.map((l) => [l.language, l.fluency].filter(Boolean).join(" — ")).join(" · "));
  }
  if (cv.certificates.length) {
    w.titulo(t.certificaciones);
    for (const c of cv.certificates) w.texto([c.name, c.issuer, c.date].filter(Boolean).join(" — "));
  }
  if (cv.projects.length) {
    w.titulo(t.proyectos);
    for (const p of cv.projects) w.texto([p.name, p.description, p.url].filter(Boolean).join(" — "));
  }
  return doc.save();
}

export async function cartaAPdf(texto: string, nombre: string): Promise<Uint8Array> {
  const { doc, w } = await nuevo(`${nombre || "Carta"} - Carta de presentación`);
  for (const parrafo of texto.split(/\n{2,}/)) w.texto(parrafo, { tam: 11, antes: 8 });
  return doc.save();
}
