import { SKILLS, findMentions } from "../analisis/habilidades";
import { enOtroIdioma, prep } from "../analisis/texto";
import type { IdiomaDoc } from "../documentos/aMedida";
import type { PerfilJson } from "../perfil/estructurado";

// ---------------------------------------------------------------------------------------------------------------
// Plataformas donde registrarse

export type PlataformaId = "workana" | "upwork" | "freelancer" | "braintrust" | "fiverr" | "toptal" | "turing" | "andela" | "arc";
export type EstadoPlataforma = "pendiente" | "registrado" | "descartada";

export interface Plataforma {
  id: PlataformaId;
  nombre: string;
  sitio: string;
  /** Cómo se consigue trabajo ahí. */
  modelo: string;
  /** Qué hace EmpleaTech por ti en esa plataforma. */
  ayuda: string;
}

export const PLATAFORMAS: Plataforma[] = [
  {
    id: "workana",
    nombre: "Workana",
    sitio: "https://www.workana.com",
    modelo: "La más grande de LatAm, en español y portugués. Propones a proyectos publicados.",
    ayuda: "No permite acceso automático: abre tú el proyecto y la extensión de EmpleaTech te arma la propuesta ahí mismo (o pégalo arriba).",
  },
  {
    id: "upwork",
    nombre: "Upwork",
    sitio: "https://www.upwork.com",
    modelo: "La más grande del mundo. Cada propuesta cuesta «Connects» (créditos de pago).",
    ayuda: "Cerró sus feeds públicos en 2024 y su API pide aprobación: abre tú el proyecto y la extensión te arma la propuesta (o pégalo arriba).",
  },
  {
    id: "freelancer",
    nombre: "Freelancer.com",
    sitio: "https://www.freelancer.com",
    modelo: "Proyectos de todo el mundo con presupuesto visible. Propones a proyectos publicados.",
    ayuda: "Integrada: sus proyectos llegan a Vacantes ya puntuados, y la extensión pone la propuesta en su formulario.",
  },
  {
    id: "braintrust",
    nombre: "Braintrust",
    sitio: "https://www.usebraintrust.com",
    modelo: "Proyectos de tecnología bien pagados; pide un perfil aprobado para postularte.",
    ayuda: "Integrada: sus proyectos llegan a Vacantes ya puntuados.",
  },
  {
    id: "fiverr",
    nombre: "Fiverr",
    sitio: "https://www.fiverr.com",
    modelo: "Al revés: publicas servicios («gigs») con precio y los clientes te encuentran.",
    ayuda: "No hay proyectos que buscar: usa el gig redactado abajo como punto de partida.",
  },
  {
    id: "toptal",
    nombre: "Toptal",
    sitio: "https://www.toptal.com",
    modelo: "Red con selección exigente (entrevistas y pruebas técnicas); ellos te asignan clientes.",
    ayuda: "Te registras una vez con el perfil de abajo; no publica proyectos.",
  },
  {
    id: "turing",
    nombre: "Turing",
    sitio: "https://www.turing.com",
    modelo: "Contratos remotos de largo plazo con empresas de EE. UU.; pruebas técnicas al registrarte.",
    ayuda: "Te registras una vez con el perfil de abajo.",
  },
  {
    id: "andela",
    nombre: "Andela",
    sitio: "https://andela.com",
    modelo: "Red de talento de LatAm y África para empresas globales.",
    ayuda: "Te registras una vez con el perfil de abajo.",
  },
  {
    id: "arc",
    nombre: "Arc.dev",
    sitio: "https://arc.dev",
    modelo: "Trabajo remoto para desarrolladores, freelance y tiempo completo.",
    ayuda: "Te registras una vez con el perfil de abajo.",
  },
];

export type SeguimientoFreelance = Record<PlataformaId, EstadoPlataforma>;

const ESTADOS: EstadoPlataforma[] = ["pendiente", "registrado", "descartada"];

export function sanitizarSeguimiento(x: unknown): SeguimientoFreelance {
  const o = typeof x === "object" && x !== null && !Array.isArray(x) ? (x as Record<string, unknown>) : {};
  return Object.fromEntries(
    PLATAFORMAS.map((p) => [p.id, ESTADOS.includes(o[p.id] as EstadoPlataforma) ? (o[p.id] as EstadoPlataforma) : "pendiente"]),
  ) as SeguimientoFreelance;
}

// ---------------------------------------------------------------------------------------------------------------
// Perfil freelance: los textos que piden todas las plataformas, sacados solo de tu CV

/** Límites de las plataformas más estrictas (Upwork: titular 70; Fiverr: título 80 y descripción 1200). */
export const LIMITES = { titular: 70, descripcion: 2000, tituloGig: 80, descripcionGig: 1200 } as const;

export interface PerfilFreelance {
  idioma: IdiomaDoc;
  titular: string;
  descripcion: string;
  habilidades: string[];
  gig: { titulo: string; descripcion: string };
}

/** Tus habilidades en el orden en que las pusiste en el CV (ese orden ya dice qué quieres destacar). */
function habilidadesDelPerfil(p: PerfilJson): string[] {
  const vistas = new Set<string>();
  const out: string[] = [];
  for (const k of p.skills.flatMap((s) => s.keywords)) {
    const clave = prep(k).folded.trim();
    if (!clave || vistas.has(clave)) continue;
    vistas.add(clave);
    out.push(k.trim());
  }
  return out;
}

/** Las que son tecnologías (lenguajes y frameworks), para el título de un gig. */
function tecnologias(habilidades: string[]): string[] {
  return habilidades.filter((h) => {
    const t = prep(h);
    return SKILLS.some((s) => ["lenguaje", "backend", "frontend"].includes(s.cat) && findMentions(t.folded, t.orig, s).length);
  });
}

function lista(items: string[], idioma: IdiomaDoc): string {
  if (items.length <= 1) return items.join("");
  return `${items.slice(0, -1).join(", ")}${idioma === "es" ? " y " : " and "}${items[items.length - 1]}`;
}

function recortar(texto: string, max: number): string {
  return texto.length <= max ? texto : `${texto.slice(0, max - 1).trimEnd()}…`;
}

function titular(label: string | undefined, habilidades: string[]): string {
  const base = label?.trim() ?? "";
  for (let n = Math.min(4, habilidades.length); n >= 0; n--) {
    const extra = habilidades.slice(0, n).join(" · ");
    const t = base && extra ? `${base} | ${extra}` : base || extra;
    if (t.length <= LIMITES.titular) return t;
  }
  return recortar(base, LIMITES.titular);
}

export function perfilFreelance(p: PerfilJson, idioma: IdiomaDoc): PerfilFreelance {
  const es = idioma === "es";
  // Frases del CV solo si están en el idioma del texto: nunca se traducen ni se inventan.
  const propia = (t: string | undefined) => (t && !enOtroIdioma(t, idioma) ? t.trim() : undefined);
  const habilidades = habilidadesDelPerfil(p);
  const top = habilidades.slice(0, 6);
  const label = p.basics.label;

  const partes: string[] = [];
  const resumen = propia(p.basics.summary);
  if (resumen) partes.push(resumen);
  else if (label || top.length) {
    partes.push(
      es
        ? `${label ? `Soy ${label}` : "Trabajo"}${top.length ? `${label ? " y trabajo" : ""} con ${lista(top, idioma)}` : ""}.`
        : `${label ? `I'm a ${label}` : "I work"}${top.length ? `${label ? " working" : ""} with ${lista(top, idioma)}` : ""}.`,
    );
  }
  if (resumen && top.length) partes.push(`${es ? "Stack principal" : "Main stack"}: ${top.join(", ")}.`);

  {
    const logros = p.work
      .flatMap((w) => w.highlights)
      .filter((h) => propia(h))
      .slice(0, 3);
    if (logros.length) partes.push(`${es ? "Trabajo reciente" : "Recent work"}:\n${logros.map((l) => `- ${l.replace(/[.;]+$/, "")}.`).join("\n")}`);
  }
  const proyectos = p.projects.filter((pr) => pr.url).slice(0, 3);
  if (proyectos.length) partes.push(`${es ? "Proyectos" : "Projects"}:\n${proyectos.map((pr) => `- ${pr.name}: ${pr.url}`).join("\n")}`);
  const certs = p.certificates.slice(0, 3).map((c) => c.name);
  if (certs.length) partes.push(`${es ? "Certificaciones" : "Certifications"}: ${certs.join("; ")}.`);
  partes.push(
    es
      ? "Escríbeme con los detalles de tu proyecto y te respondo con un plan y tiempos claros."
      : "Send me your project details and I'll reply with a clear plan and timeline.",
  );

  const tec = tecnologias(habilidades);
  const tituloGig = recortar(
    tec.length >= 2
      ? es
        ? `Desarrollaré aplicaciones con ${tec[0]} y ${tec[1]}`
        : `I will build ${tec[0]} and ${tec[1]} applications`
      : tec.length
        ? es
          ? `Desarrollaré aplicaciones con ${tec[0]}`
          : `I will build ${tec[0]} applications`
        : es
          ? "Desarrollaré tu proyecto de software"
          : "I will build your software project",
    LIMITES.tituloGig,
  );

  const descripcion = recortar(partes.join("\n\n"), LIMITES.descripcion);
  return {
    idioma,
    titular: titular(label, top),
    descripcion,
    habilidades: habilidades.slice(0, 15),
    gig: { titulo: tituloGig, descripcion: recortar(descripcion, LIMITES.descripcionGig) },
  };
}
