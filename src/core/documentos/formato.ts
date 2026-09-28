import type { PerfilJson } from "../perfil/estructurado";
import type { IdiomaDoc } from "./aMedida";

export const TITULOS: Record<IdiomaDoc, Record<"resumen" | "experiencia" | "educacion" | "habilidades" | "idiomas" | "certificaciones" | "proyectos" | "actual", string>> = {
  es: { resumen: "Resumen", experiencia: "Experiencia", educacion: "Educación", habilidades: "Habilidades", idiomas: "Idiomas", certificaciones: "Certificaciones", proyectos: "Proyectos", actual: "actual" },
  en: { resumen: "Summary", experiencia: "Experience", educacion: "Education", habilidades: "Skills", idiomas: "Languages", certificaciones: "Certifications", proyectos: "Projects", actual: "Present" },
};

const MESES: Record<IdiomaDoc, string[]> = {
  es: ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"],
  en: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
};

/** «2021-01» → «ene 2021» / «Jan 2021»; «2019» se queda igual. */
export function fechaLegible(f: string | undefined, idioma: IdiomaDoc): string {
  if (!f) return "";
  const [a, m] = f.split("-");
  return m ? `${MESES[idioma][Number(m) - 1] ?? ""} ${a}`.trim() : a;
}

export function rangoFechas(inicio: string | undefined, fin: string | undefined, idioma: IdiomaDoc): string {
  if (!inicio && !fin) return "";
  return `${fechaLegible(inicio, idioma)} – ${fin ? fechaLegible(fin, idioma) : TITULOS[idioma].actual}`.replace(/^ – /, "");
}

/** CV en texto plano, en orden y sin adornos: sirve para pegarlo en formularios que piden «pega tu CV». */
export function cvATexto(cv: PerfilJson, idioma: IdiomaDoc): string {
  const t = TITULOS[idioma];
  const b = cv.basics;
  const ubicacion = [b.location?.city, b.location?.region, b.location?.countryCode].filter(Boolean).join(", ");
  const contacto = [b.email, b.phone, ubicacion, b.url, ...b.profiles.map((p) => p.url)].filter(Boolean).join(" · ");
  const bloques: string[] = [[b.name, b.label, contacto].filter(Boolean).join("\n")];
  if (b.summary) bloques.push(`${t.resumen.toUpperCase()}\n${b.summary}`);
  if (cv.work.length) {
    bloques.push(
      `${t.experiencia.toUpperCase()}\n${cv.work
        .map((w) => [[w.position, w.name].filter(Boolean).join(" — "), [rangoFechas(w.startDate, w.endDate, idioma), w.location].filter(Boolean).join(" · "), w.summary, ...w.highlights.map((h) => `- ${h}`)].filter(Boolean).join("\n"))
        .join("\n\n")}`,
    );
  }
  if (cv.education.length) {
    bloques.push(`${t.educacion.toUpperCase()}\n${cv.education.map((e) => [[e.studyType, e.area].filter(Boolean).join(" "), e.institution, rangoFechas(e.startDate, e.endDate, idioma)].filter(Boolean).join(" — ")).join("\n")}`);
  }
  if (cv.skills.length) bloques.push(`${t.habilidades.toUpperCase()}\n${cv.skills.map((s) => `${s.name}: ${s.keywords.join(", ")}`).join("\n")}`);
  if (cv.languages.length) bloques.push(`${t.idiomas.toUpperCase()}\n${cv.languages.map((l) => [l.language, l.fluency].filter(Boolean).join(" — ")).join("\n")}`);
  if (cv.certificates.length) bloques.push(`${t.certificaciones.toUpperCase()}\n${cv.certificates.map((c) => [c.name, c.issuer, c.date].filter(Boolean).join(" — ")).join("\n")}`);
  if (cv.projects.length) bloques.push(`${t.proyectos.toUpperCase()}\n${cv.projects.map((p) => [p.name, p.description, p.url].filter(Boolean).join(" — ")).join("\n")}`);
  return bloques.join("\n\n");
}
