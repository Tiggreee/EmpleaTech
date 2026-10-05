import type { PerfilJson } from "../perfil/estructurado";
import type { Respuestas } from "../perfil/respuestas";
import { AJUSTES_COLA_INICIALES } from "./cola";
import { MAX_FUENTES_ACTIVAS, esFuenteFreelance, type Consulta, type FuenteDeEmpresas } from "./fuentes";
import { FUENTES, type FuenteId } from "./vacante";

export interface PreferenciasBusqueda {
  /** Hasta 5 plataformas de empleo activas, más las de proyectos freelance que quieras. */
  fuentes: FuenteId[];
  palabras: string[];
  soloRemoto: boolean;
  /** Ocultar becas, prácticas y puestos junior. */
  ocultarEntrada: boolean;
  empresas: Record<FuenteDeEmpresas, string[]>;
  /** Tope de vacantes nuevas por plataforma en cada búsqueda. */
  maxPorFuente: number;
  /** Vacantes del día: cuántos empleos y cuántas propuestas freelance al día, y cuántas como máximo de una misma plataforma. */
  metaDiaria: number;
  metaFreelance: number;
  topePorFuente: number;
}

/** Arranque sensato para LatAm: dos fuentes de la región, dos remotas y los tableros oficiales de empresas. */
export const FUENTES_INICIALES: FuenteId[] = ["getonboard", "jobicy", "remotive", "remoteok", "greenhouse"];

const TOKEN = /^[a-z0-9][a-z0-9_-]{0,79}$/;

function lista(x: unknown, max: number, largo: number): string[] {
  return Array.isArray(x)
    ? [...new Set(x.filter((s): s is string => typeof s === "string").map((s) => s.trim()).filter((s) => s && s.length <= largo))].slice(0, max)
    : [];
}

export function sanitizarPreferencias(crudo: unknown, porDefecto: PreferenciasBusqueda): PreferenciasBusqueda {
  if (typeof crudo !== "object" || crudo === null) return porDefecto;
  const o = crudo as Record<string, unknown>;
  const validas = Array.isArray(o.fuentes) ? [...new Set(o.fuentes.filter((f): f is FuenteId => (FUENTES as readonly string[]).includes(f as string)))] : null;
  // El tope aplica a las plataformas de empleo; los proyectos freelance son un extra aparte.
  const fuentes = validas ? [...validas.filter((f) => !esFuenteFreelance(f)).slice(0, MAX_FUENTES_ACTIVAS), ...validas.filter(esFuenteFreelance)] : porDefecto.fuentes;
  const e = (typeof o.empresas === "object" && o.empresas !== null ? o.empresas : {}) as Record<string, unknown>;
  const tokens = (k: FuenteDeEmpresas) => (Array.isArray(e[k]) ? lista(e[k], 25, 80).map((t) => t.toLowerCase()).filter((t) => TOKEN.test(t)) : porDefecto.empresas[k]);
  const entero = (x: unknown, def: number, min: number, maxV: number) =>
    Math.max(min, Math.min(maxV, typeof x === "number" && Number.isFinite(x) ? Math.round(x) : def));
  const max = entero(o.maxPorFuente, porDefecto.maxPorFuente, 5, 200);
  return {
    fuentes,
    palabras: Array.isArray(o.palabras) ? lista(o.palabras, 12, 60) : porDefecto.palabras,
    soloRemoto: typeof o.soloRemoto === "boolean" ? o.soloRemoto : porDefecto.soloRemoto,
    ocultarEntrada: typeof o.ocultarEntrada === "boolean" ? o.ocultarEntrada : porDefecto.ocultarEntrada,
    empresas: { greenhouse: tokens("greenhouse"), lever: tokens("lever"), ashby: tokens("ashby") },
    maxPorFuente: max,
    metaDiaria: entero(o.metaDiaria, porDefecto.metaDiaria, 1, 100),
    metaFreelance: entero(o.metaFreelance, porDefecto.metaFreelance, 0, 50),
    topePorFuente: entero(o.topePorFuente, porDefecto.topePorFuente, 1, 50),
  };
}

/** Palabras de búsqueda sacadas del perfil: el título profesional y los puestos recientes. */
export function palabrasDelPerfil(perfil: PerfilJson | undefined): string[] {
  if (!perfil) return [];
  const titulos = [perfil.basics.label, ...perfil.work.slice(0, 2).map((w) => w.position)].filter((t): t is string => !!t);
  // «Desarrolladora Backend Senior» → «Desarrolladora Backend»: los niveles filtran de más.
  const limpio = titulos.map((t) =>
    t
      .replace(/(^|\s)(sr|senior|jr|junior|semi[- ]?senior|ssr|lead|l[ií]der|principal|staff)\.?(?=\s|$)/gi, " ")
      .replace(/\s+/g, " ")
      .trim(),
  );
  return [...new Set(limpio.filter((t) => t.length >= 3))].slice(0, 3);
}

/** Años desde el primer puesto del CV hasta hoy (o hasta el último que terminó); sin fechas, undefined. */
export function aniosDelPerfil(perfil: PerfilJson | undefined, ahora = new Date()): number | undefined {
  const anio = (f: string | undefined) => (f && /^\d{4}/.test(f) ? Number(f.slice(0, 4)) : undefined);
  const inicios = (perfil?.work ?? []).flatMap((w) => anio(w.startDate) ?? []);
  if (!inicios.length) return undefined;
  const fines = (perfil?.work ?? []).map((w) => anio(w.endDate) ?? ahora.getFullYear());
  return Math.max(0, Math.max(...fines) - Math.min(...inicios));
}

export function preferenciasIniciales(perfil: PerfilJson | undefined, respuestas: Respuestas, empresas: Record<FuenteDeEmpresas, string[]>): PreferenciasBusqueda {
  const anios = respuestas.aniosExperiencia ?? aniosDelPerfil(perfil);
  return {
    fuentes: FUENTES_INICIALES,
    palabras: palabrasDelPerfil(perfil),
    soloRemoto: respuestas.modalidades.length > 0 && respuestas.modalidades.every((m) => m === "remoto"),
    // Con 3 años o más de experiencia, las becas y los puestos junior solo llenan la lista; se pueden volver a mostrar.
    ocultarEntrada: anios !== undefined && anios >= 3,
    empresas,
    maxPorFuente: 60,
    metaDiaria: AJUSTES_COLA_INICIALES.metaDiaria,
    metaFreelance: AJUSTES_COLA_INICIALES.metaFreelance,
    topePorFuente: AJUSTES_COLA_INICIALES.topePorFuente,
  };
}

export function consultaDe(p: PreferenciasBusqueda, respuestas: Respuestas): Consulta {
  return { palabras: p.palabras, soloRemoto: p.soloRemoto, ocultarEntrada: p.ocultarEntrada, paises: respuestas.paisesAutorizado, empresas: p.empresas, maxPorFuente: p.maxPorFuente };
}
