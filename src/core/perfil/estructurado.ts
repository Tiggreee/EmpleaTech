import { detectarHabilidades } from "../analisis/analizador";
import type { Categoria } from "../analisis/habilidades";
import { prep } from "../analisis/texto";

/**
 * Perfil estructurado con las claves del estándar JSON Resume (jsonresume.org), para poder exportarlo e importarlo
 * con otras herramientas. Las fechas van como "AAAA-MM" o "AAAA"; un puesto actual no lleva endDate.
 */
export interface PerfilJson {
  basics: {
    name: string;
    label?: string;
    email?: string;
    phone?: string;
    url?: string;
    summary?: string;
    location?: { city?: string; region?: string; countryCode?: string };
    profiles: { network: string; url: string; username?: string }[];
  };
  work: Trabajo[];
  education: Estudio[];
  skills: { name: string; keywords: string[] }[];
  languages: { language: string; fluency?: string }[];
  certificates: { name: string; issuer?: string; date?: string }[];
  projects: { name: string; description?: string; url?: string }[];
}

export interface Trabajo {
  name?: string;
  position?: string;
  location?: string;
  startDate?: string;
  endDate?: string;
  summary?: string;
  highlights: string[];
}

export interface Estudio {
  institution?: string;
  area?: string;
  studyType?: string;
  startDate?: string;
  endDate?: string;
}

export type CampoClave = "nombre" | "correo" | "telefono" | "experiencia" | "educacion" | "habilidades";

export interface ResultadoLectura {
  perfil: PerfilJson;
  /** Campos importantes que no encontramos y conviene completar a mano. */
  faltantes: CampoClave[];
}

export function perfilVacio(): PerfilJson {
  return { basics: { name: "", profiles: [] }, work: [], education: [], skills: [], languages: [], certificates: [], projects: [] };
}

// ---------------------------------------------------------------------------------------------------------------
// Secciones

type Seccion = "resumen" | "experiencia" | "educacion" | "habilidades" | "idiomas" | "certificaciones" | "proyectos" | "otra";

const SECCIONES: [Seccion, RegExp][] = [
  ["resumen", /^(?:resumen(?: profesional)?|perfil(?: profesional)?|sobre mi|acerca de mi|extracto|objetivo(?: profesional)?|(?:professional )?summary|profile|about(?: me)?|objective)$/],
  ["experiencia", /^(?:experiencia(?: profesional| laboral)?|historial laboral|trayectoria(?: profesional| laboral)?|(?:work |professional )?experience|employment(?: history)?|work history)$/],
  ["educacion", /^(?:educacion|formacion(?: academica)?|estudios|education|academic background)$/],
  ["habilidades", /^(?:habilidades(?: tecnicas)?|competencias(?: tecnicas)?|conocimientos(?: tecnicos)?|aptitudes|tecnologias|herramientas|stack(?: tecnologico)?|(?:technical )?skills|core competencies|technologies|tools)$/],
  ["idiomas", /^(?:idiomas|lenguas|languages)$/],
  ["certificaciones", /^(?:certificaciones|certificados|cursos(?: y certificaciones)?|licencias y certificaciones|certifications|certificates|licenses(?: (?:&|and) certifications)?|courses)$/],
  ["proyectos", /^(?:proyectos(?: personales| destacados)?|projects|personal projects|side projects|portafolio|portfolio)$/],
  ["otra", /^(?:referencias|references|intereses|interests|voluntariado|volunteer(?:ing)?|logros|achievements|premios|awards|publicaciones|publications|hobbies)$/],
];

function seccionDeLinea(linea: string): Seccion | null {
  if (linea.length > 45) return null;
  const f = prep(linea).folded.replace(/^[#\s]+/, "").replace(/[:：\s]+$/, "").replace(/\s+/g, " ");
  for (const [s, re] of SECCIONES) if (re.test(f)) return s;
  return null;
}

interface Bloques {
  cabecera: string[];
  secciones: Map<Seccion, string[]>;
}

function partirEnSecciones(texto: string): Bloques {
  const cabecera: string[] = [];
  const secciones = new Map<Seccion, string[]>();
  let actual: string[] = cabecera;
  for (const linea of texto.split("\n")) {
    const s = seccionDeLinea(linea.trim());
    if (s) {
      actual = secciones.get(s) ?? [];
      secciones.set(s, actual);
      continue;
    }
    actual.push(linea);
  }
  return { cabecera, secciones };
}

// ---------------------------------------------------------------------------------------------------------------
// Fechas

const MESES: Record<string, number> = {
  ene: 1, enero: 1, jan: 1, january: 1,
  feb: 2, febrero: 2, february: 2,
  mar: 3, marzo: 3, march: 3,
  abr: 4, abril: 4, apr: 4, april: 4,
  may: 5, mayo: 5,
  jun: 6, junio: 6, june: 6,
  jul: 7, julio: 7, july: 7,
  ago: 8, agosto: 8, aug: 8, august: 8,
  sep: 9, sept: 9, septiembre: 9, setiembre: 9, september: 9,
  oct: 10, octubre: 10, october: 10,
  nov: 11, noviembre: 11, november: 11,
  dic: 12, diciembre: 12, dec: 12, december: 12,
};

const MES = `(?:${Object.keys(MESES).sort((a, b) => b.length - a.length).join("|")})\\.?`;
const FECHA = `(?:${MES}\\s*(?:de\\s+|del\\s+)?(?:19|20)\\d{2}|(?:0?[1-9]|1[0-2])\\s*[/.-]\\s*(?:19|20)\\d{2}|(?:19|20)\\d{2})`;
const PRESENTE = "(?:presente|actualidad|actual|hoy|la fecha|present|current|now|today)";
const RE_RANGO = new RegExp(`(${FECHA})\\s*(?:-|–|—|a|al|hasta|to|until)\\s*(${FECHA}|${PRESENTE})`);
const RE_FECHA_SOLA = new RegExp(`(${FECHA})`);

/** "ene 2020" → "2020-01"; "03/2021" → "2021-03"; "2019" → "2019". Recibe texto plegado. */
export function normalizarFecha(folded: string): string | undefined {
  const t = folded.trim().replace(/\s+/g, " ");
  let m = new RegExp(`^(${MES})\\s*(?:de |del )?((?:19|20)\\d{2})$`).exec(t);
  if (m) {
    const mes = MESES[m[1].replace(/\.$/, "")];
    return mes ? `${m[2]}-${String(mes).padStart(2, "0")}` : m[2];
  }
  m = /^(0?[1-9]|1[0-2])\s*[/.-]\s*((?:19|20)\d{2})$/.exec(t);
  if (m) return `${m[2]}-${m[1].padStart(2, "0")}`;
  m = /^((?:19|20)\d{2})$/.exec(t);
  return m ? m[1] : undefined;
}

interface RangoEnLinea {
  inicio?: string;
  fin?: string;
  /** Texto de la línea sin el rango de fechas. */
  resto: string;
}

function rangoEnLinea(linea: string): RangoEnLinea | null {
  const { orig, folded } = prep(linea);
  const m = RE_RANGO.exec(folded);
  if (!m) return null;
  const actual = new RegExp(`^${PRESENTE}$`).test(m[2]);
  const resto = (orig.slice(0, m.index) + " " + orig.slice(m.index + m[0].length)).replace(/[(),|·•]\s*\)?\s*$/, "");
  return { inicio: normalizarFecha(m[1]), fin: actual ? undefined : normalizarFecha(m[2]), resto: limpiarBordes(resto) };
}

function limpiarBordes(s: string): string {
  return s.replace(/\(\s*\)/g, " ").replace(/\s+/g, " ").replace(/^[\s|·•,;:–—-]+|[\s|·•,;:–—-]+$/g, "").trim();
}

// ---------------------------------------------------------------------------------------------------------------
// Datos básicos

const RE_CORREO = /[\w.+-]+@[\w-]+(?:\.[\w-]+)+/;
const RE_URL = /\b(?:https?:\/\/)?(?:www\.)?[a-z0-9-]+(?:\.[a-z0-9-]+)*\.(?:com|mx|co|io|dev|me|net|org|app|site|page|ar|cl|pe|es|lat|tech|xyz)(?:\/[^\s,;|)]*)?/gi;
const RE_TELEFONO = /(?:\+\d{1,3}[\s.-]?)?(?:\(\d{2,3}\)[\s.-]?)?\d[\d\s.-]{6,}\d/g;

function telefonoValido(candidato: string): boolean {
  const digitos = candidato.replace(/\D/g, "");
  if (digitos.length < 8 || digitos.length > 15) return false;
  // Un rango de años («2019 - 2022») no es un teléfono.
  return !/^(?:19|20)\d{2}\s*[-–.]\s*(?:19|20)\d{2}$/.test(candidato.trim());
}

function red(url: string): { network: string; username?: string } {
  const u = url.replace(/^https?:\/\//i, "").replace(/^www\./i, "");
  const [dominio, ...ruta] = u.split("/");
  const partes = ruta.filter(Boolean);
  if (/linkedin\.com$/i.test(dominio)) return { network: "LinkedIn", username: partes[0] === "in" ? partes[1] : undefined };
  if (/github\.com$/i.test(dominio)) return { network: "GitHub", username: partes[0] };
  if (/gitlab\.com$/i.test(dominio)) return { network: "GitLab", username: partes[0] };
  if (/behance\.net$/i.test(dominio)) return { network: "Behance", username: partes[0] };
  if (/dribbble\.com$/i.test(dominio)) return { network: "Dribbble", username: partes[0] };
  return { network: "" };
}

function urlCompleta(url: string): string {
  return /^https?:\/\//i.test(url) ? url : `https://${url}`;
}

const PAISES: Record<string, string> = {
  mexico: "MX", colombia: "CO", argentina: "AR", chile: "CL", peru: "PE", venezuela: "VE", ecuador: "EC", uruguay: "UY",
  paraguay: "PY", bolivia: "BO", guatemala: "GT", "costa rica": "CR", panama: "PA", honduras: "HN", "el salvador": "SV",
  nicaragua: "NI", "republica dominicana": "DO", cuba: "CU", "puerto rico": "PR", espana: "ES", spain: "ES",
  brasil: "BR", brazil: "BR", "estados unidos": "US", "united states": "US", usa: "US", canada: "CA",
};
const CIUDADES = /\b(?:cdmx|ciudad de mexico|mexico city|guadalajara|monterrey|puebla|queretaro|merida|tijuana|leon|bogota|medellin|cali|buenos aires|cordoba|santiago|lima|caracas|quito|montevideo|madrid|barcelona)\b/;

function ubicacionDe(linea: string): PerfilJson["basics"]["location"] | undefined {
  const { folded } = prep(linea);
  if (/\d|@|https?:|www\./.test(folded) || linea.length > 70) return undefined;
  const pais = Object.keys(PAISES).find((p) => new RegExp(`\\b${p}\\b`).test(folded));
  if (!pais && !CIUDADES.test(folded)) return undefined;
  // «Morelia, Mexico (Remote / Hybrid)»: lo que va entre paréntesis es modalidad, no parte del lugar.
  const partes = linea.replace(/\([^)]*\)/g, " ").split(/\s*[,|·]\s*/).map((p) => p.trim()).filter(Boolean);
  const sinPais = partes.filter((p) => !Object.keys(PAISES).includes(prep(p).folded));
  return {
    city: sinPais[0],
    region: sinPais.length > 1 ? sinPais[1] : undefined,
    countryCode: pais ? PAISES[pais] : undefined,
  };
}

function pareceNombre(linea: string): boolean {
  if (linea.length < 4 || linea.length > 50 || /[\d@/:|]/.test(linea)) return false;
  const palabras = linea.split(/\s+/);
  return palabras.length >= 2 && palabras.length <= 5 && palabras.every((p) => /^\p{L}[\p{L}'.-]*$/u.test(p));
}

function tituloPropio(s: string): string {
  if (s !== s.toUpperCase()) return s;
  return s.toLowerCase().replace(/(^|[\s'-])(\p{L})/gu, (_, a: string, b: string) => a + b.toUpperCase());
}

function esVineta(linea: string): boolean {
  return /^- /.test(linea);
}

function sinVineta(linea: string): string {
  return linea.replace(/^- /, "").trim();
}

function leerBasicos(cabecera: string[], textoCompleto: string): PerfilJson["basics"] {
  const basics: PerfilJson["basics"] = { name: "", profiles: [] };
  const correo = RE_CORREO.exec(textoCompleto);
  if (correo) basics.email = correo[0];

  const zonaContacto = cabecera.length ? cabecera.join("\n") : textoCompleto.split("\n").slice(0, 12).join("\n");
  const sinCorreos = zonaContacto.replace(new RegExp(RE_CORREO.source, "g"), " ");
  for (const m of sinCorreos.replace(RE_URL, " ").matchAll(RE_TELEFONO)) {
    if (telefonoValido(m[0])) {
      basics.phone = m[0].trim();
      break;
    }
  }

  const vistos = new Set<string>();
  for (const m of sinCorreos.matchAll(RE_URL)) {
    const url = m[0].replace(/[.)]+$/, "");
    const clave = url.toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/\/$/, "");
    if (vistos.has(clave)) continue;
    vistos.add(clave);
    const r = red(url);
    if (r.network) basics.profiles.push({ network: r.network, url: urlCompleta(url), ...(r.username ? { username: r.username } : {}) });
    else if (!basics.url) basics.url = urlCompleta(url);
  }

  const lineas = cabecera.map((l) => l.trim()).filter(Boolean).slice(0, 8);
  const iNombre = lineas.findIndex(pareceNombre);
  if (iNombre >= 0) {
    basics.name = tituloPropio(lineas[iNombre]);
    const siguiente = lineas[iNombre + 1];
    const previa = lineas[iNombre - 1];
    const esTitulo = (l: string | undefined): l is string => !!l && l.length <= 90 && !/@|https?:|www\.|\d{4}/.test(l) && !ubicacionDe(l);
    if (esTitulo(siguiente) && siguiente.length <= 70) {
      basics.label = limpiarBordes(siguiente.split(/\s*[|·]\s*/)[0]);
    } else if (esTitulo(previa) && RE_ROL.test(prep(previa).folded)) {
      // Muchos CV ponen el título profesional arriba del nombre.
      basics.label = limpiarBordes(previa.split(/\s*[|·]\s*/)[0]);
    }
  }
  // La primera ubicación con país gana; si ninguna trae país, la primera que parezca ciudad.
  const candidatas = lineas.flatMap((l) => l.split(/\s*[|·•]\s*/)).map(ubicacionDe).filter((u) => u !== undefined);
  const ubicacion = candidatas.find((u) => u.countryCode) ?? candidatas[0];
  if (ubicacion) basics.location = ubicacion;
  return basics;
}

// ---------------------------------------------------------------------------------------------------------------
// Experiencia

const RE_ROL =
  /\b(?:desarrollador(?:a)?|developer|ingenier[oa]|engineer|analista|analyst|gerente|manager|l[ií]der|lead|jef[ea]|coordinador(?:a)?|director(?:a)?|consultor(?:a)?|consultant|especialista|specialist|arquitect[oa]|architect|dise[nñ]ador(?:a)?|designer|administrador(?:a)?|administrator|asistente|assistant|ejecutiv[oa]|practicante|becari[oa]|intern|t[eé]cnic[oa]|technician|cient[ií]fic[oa]|scientist|programador(?:a)?|programmer|tester|qa|soporte|support|vendedor(?:a)?|representante|supervisor(?:a)?|auxiliar|contador(?:a)?|head|vp|cto|ceo|cfo|coo|fundador(?:a)?|founder|co-?founder|freelance(?:r)?|product owner|scrum master|devops|sre|full[- ]?stack|back[- ]?end|front[- ]?end|data)\b/i;
const RE_LUGAR = /\b(?:remoto|remote|h[ií]brido|hybrid|presencial|on-?site)\b/i;

function partirCabecera(texto: string): string[] {
  return texto
    .split(/\s+(?:\||·|•|—|–|-|@)\s+|\s*,\s+(?=\p{Lu})|\s+(?:at|en)\s+(?=\p{Lu})/u)
    .map(limpiarBordes)
    .filter(Boolean);
}

function asignarCabecera(partes: string[], t: Trabajo): void {
  for (const p of partes) {
    const f = prep(p).folded;
    if (!t.location && (RE_LUGAR.test(p) || (ubicacionDe(p) && !RE_ROL.test(p)))) {
      t.location = p;
    } else if (!t.position && RE_ROL.test(f)) {
      t.position = p;
    } else if (!t.name) {
      t.name = p;
    } else if (!t.position) {
      t.position = p;
    }
  }
  // Sin palabras de rol, lo más común es «Puesto — Empresa».
  if (t.name && !t.position && partes.length >= 2) {
    t.position = t.name;
    t.name = partes.find((p) => p !== t.position && p !== t.location);
  }
}

/** Una cabecera de puesto es corta y no es una oración: no termina en punto ni empieza en minúscula. */
function pareceCabecera(l: string): boolean {
  return !!l && !esVineta(l) && l.length <= 90 && !/[.;]$/.test(l) && !/^\p{Ll}/u.test(l);
}

function leerExperiencia(lineas: string[]): Trabajo[] {
  const limpias = lineas.map((l) => l.trim());
  const anclas: number[] = [];
  limpias.forEach((l, i) => {
    if (!esVineta(l) && rangoEnLinea(l)) anclas.push(i);
  });
  if (anclas.length === 0) return [];

  const trabajos: Trabajo[] = [];
  let consumidoHasta = -1;
  anclas.forEach((ancla, k) => {
    const rango = rangoEnLinea(limpias[ancla]);
    if (!rango) return;
    const t: Trabajo = { highlights: [], startDate: rango.inicio, ...(rango.fin ? { endDate: rango.fin } : {}) };

    // Hasta dos líneas cortas justo antes de la fecha forman la cabecera («Puesto», «Empresa»).
    const antes: string[] = [];
    for (let i = ancla - 1; i > consumidoHasta && antes.length < 2; i--) {
      const l = limpias[i];
      if (!l) break;
      if (!pareceCabecera(l)) break;
      antes.unshift(l);
    }
    const siguienteAncla = anclas[k + 1] ?? limpias.length;
    let fin = siguienteAncla;
    // Las líneas de cabecera del siguiente puesto no son parte de este.
    if (k + 1 < anclas.length) {
      let i = siguienteAncla - 1;
      let reservadas = 0;
      while (i > ancla && reservadas < 2 && limpias[i] && pareceCabecera(limpias[i])) {
        i--;
        reservadas++;
      }
      fin = i + 1;
    }

    const partes = [...antes.flatMap(partirCabecera), ...partirCabecera(rango.resto)];
    let i = ancla + 1;
    // Formato «Empresa   2020 – 2022» seguido de «Puesto»: la línea siguiente completa la cabecera.
    if (partes.length < 2 && i < fin && limpias[i] && !esVineta(limpias[i]) && limpias[i].length <= 70) {
      partes.push(...partirCabecera(limpias[i]));
      i++;
    }
    asignarCabecera(partes, t);

    const resumen: string[] = [];
    // Algunos PDF dibujan las viñetas como gráficos y al extraer el texto se pierden: entonces cada oración que empieza
    // en una línea nueva es un logro, y las líneas que siguen a una oración sin terminar la continúan.
    const sinVinetas = !limpias.slice(i, fin).some(esVineta);
    for (; i < fin; i++) {
      const l = limpias[i];
      if (!l) continue;
      const ultimo = t.highlights[t.highlights.length - 1];
      if (esVineta(l)) t.highlights.push(sinVineta(l));
      else if (ultimo !== undefined && !/[.!?:]$/.test(ultimo)) t.highlights[t.highlights.length - 1] = `${ultimo} ${l}`;
      else if (sinVinetas) t.highlights.push(l);
      else resumen.push(l);
    }
    if (resumen.length) t.summary = resumen.join(" ");
    consumidoHasta = fin - 1;
    trabajos.push(t);
  });
  return trabajos;
}

// ---------------------------------------------------------------------------------------------------------------
// Educación

const RE_INSTITUCION = /\b(?:universidad|university|instituto|institute|tecnol[oó]gico|polit[eé]cnic[oa]|college|escuela|school|colegio|academia|academy|facultad|unam|ipn|itesm|uam|udg|uanl|tec de monterrey|platzi|coursera|udemy|bootcamp|tripleten|henry|ironhack|coderhouse|le wagon|digital house|academlo|bedu)\b/i;
// «B.A.» / «B.B.A.» terminan en punto, así que van fuera del \b final.
const RE_GRADO =
  /\b(?:licenciatura|licenciad[oa]|ingenier[ií]a|ingenier[oa]|maestr[ií]a|m[aá]ster|doctorado|diplomado|especialidad|t[eé]cnico superior|t[eé]cnic[oa]|tsu|bachillerato|preparatoria|bachelor(?:'s)?|master(?:'s)?|mba|ph\.?d|doctorate|associate(?:'s)?|diploma|bootcamp|program|programa|b\.?sc?|m\.?sc?)\b|\bb\.b?\.?a\.(?=\s|,|$)/i;

const tieneFecha = (l: string) => RE_FECHA_SOLA.test(prep(l).folded);

function leerEducacion(lineas: string[]): Estudio[] {
  // Un bloque por grupo de líneas separadas por renglón en blanco o por una nueva institución.
  const bloques: string[][] = [];
  let actual: string[] = [];
  for (const l of lineas.map((x) => x.trim())) {
    if (!l) {
      if (actual.length) bloques.push(actual);
      actual = [];
      continue;
    }
    // Nueva entrada: otra institución, o una segunda fecha (formato de una línea «Grado | Escuela | 2009 - 2013»).
    if (actual.length && ((RE_INSTITUCION.test(l) && actual.some((a) => RE_INSTITUCION.test(a))) || (tieneFecha(l) && actual.some(tieneFecha)))) {
      bloques.push(actual);
      actual = [];
    }
    actual.push(sinVineta(l));
  }
  if (actual.length) bloques.push(actual);

  const estudios: Estudio[] = [];
  for (const bloque of bloques) {
    const e: Estudio = {};
    for (const l of bloque) {
      const rango = rangoEnLinea(l);
      let resto = l;
      if (rango) {
        e.startDate ??= rango.inicio;
        if (rango.fin) e.endDate ??= rango.fin;
        resto = rango.resto;
      } else {
        const sola = RE_FECHA_SOLA.exec(prep(l).folded);
        if (sola && !e.endDate) {
          e.endDate = normalizarFecha(sola[1]);
          resto = limpiarBordes(l.slice(0, sola.index) + " " + l.slice(sola.index + sola[0].length));
        }
      }
      for (const parte of partirCabecera(resto)) {
        if (!e.institution && RE_INSTITUCION.test(parte)) e.institution = parte;
        else if (!e.studyType && RE_GRADO.test(parte)) {
          const m = RE_GRADO.exec(parte);
          const despues = m ? parte.slice(m.index + m[0].length).replace(/^\s*(?:en|de|in|of)\s+/i, "").trim() : "";
          e.studyType = m ? parte.slice(0, m.index + m[0].length).trim() : parte;
          if (despues) e.area = despues;
        } else if (!e.area && !RE_INSTITUCION.test(parte)) e.area = parte;
      }
    }
    if (e.institution || e.studyType || e.area) estudios.push(e);
  }
  return estudios;
}

// ---------------------------------------------------------------------------------------------------------------
// Habilidades, idiomas, certificaciones y proyectos

const NOMBRE_CATEGORIA: Record<Categoria, string> = {
  lenguaje: "Lenguajes",
  frontend: "Frontend",
  backend: "Backend",
  datos: "Datos",
  cloud: "Cloud",
  devops: "DevOps",
  ia: "IA",
  practica: "Prácticas",
  negocio: "Negocio",
  blanda: "Habilidades blandas",
  idioma: "Idiomas",
};

function leerHabilidades(texto: string, seccion: string[] | undefined): PerfilJson["skills"] {
  const porCategoria = new Map<string, string[]>();
  const conocidas = new Set<string>();
  for (const h of detectarHabilidades(texto)) {
    if (h.cat === "idioma") continue;
    const nombre = NOMBRE_CATEGORIA[h.cat];
    porCategoria.set(nombre, [...(porCategoria.get(nombre) ?? []), h.label]);
    conocidas.add(prep(h.label).folded);
  }
  const otras: string[] = [];
  for (const l of seccion ?? []) {
    const sinEtiqueta = sinVineta(l.trim()).replace(/^[^:]{1,30}:\s*/, "");
    for (const item of sinEtiqueta.split(/\s*[,;|•·]\s*|\s+\/\s+/)) {
      // «SQL (PostgreSQL, H2)» se parte por comas: quitar el paréntesis que quedó suelto.
      let t = limpiarBordes(item);
      if (t.endsWith(")") && !t.includes("(")) t = t.slice(0, -1).trim();
      if (t.startsWith("(") && !t.includes(")")) t = t.slice(1).trim();
      if (t.length < 2 || t.length > 40 || /^\d+$/.test(t)) continue;
      const f = prep(t).folded;
      if (conocidas.has(f) || detectarHabilidades(t).length) continue;
      if (!otras.some((o) => prep(o).folded === f)) otras.push(t);
    }
  }
  const skills = [...porCategoria.entries()].map(([name, keywords]) => ({ name, keywords }));
  if (otras.length) skills.push({ name: "Otras", keywords: otras.slice(0, 40) });
  return skills;
}

const IDIOMAS: Record<string, string> = {
  espanol: "Español", castellano: "Español", spanish: "Español",
  ingles: "Inglés", english: "Inglés",
  portugues: "Portugués", portuguese: "Portugués",
  frances: "Francés", french: "Francés",
  aleman: "Alemán", german: "Alemán",
  italiano: "Italiano", italian: "Italiano",
  chino: "Chino", mandarin: "Chino", chinese: "Chino",
  japones: "Japonés", japanese: "Japonés",
  coreano: "Coreano", korean: "Coreano",
};
const NIVEL =
  /\b(nativ[oa]|native|lengua materna|mother tongue|biling[uü]e|bilingual|avanzado|advanced|fluido|fluent|profesional|professional(?: working)?|intermedio(?: alto| bajo)?|upper[- ]intermediate|intermediate|b[aá]sico|basic|elemental|conversacional|conversational|[abc][12])\b/i;

function leerIdiomas(seccion: string[] | undefined, texto: string): PerfilJson["languages"] {
  const fuente = seccion?.length ? seccion : texto.split("\n").filter((l) => NIVEL.test(l) && l.length < 120);
  const out: PerfilJson["languages"] = [];
  for (const linea of fuente) {
    const { orig, folded } = prep(linea);
    for (const [clave, nombre] of Object.entries(IDIOMAS)) {
      const m = new RegExp(`\\b${clave}\\b`).exec(folded);
      if (!m || out.some((o) => o.language === nombre)) continue;
      const cola = orig.slice(m.index + clave.length, m.index + clave.length + 40);
      const nivel = NIVEL.exec(cola);
      out.push({ language: nombre, ...(nivel ? { fluency: nivel[1] } : {}) });
    }
  }
  return out;
}

function leerCertificaciones(seccion: string[] | undefined): PerfilJson["certificates"] {
  const out: PerfilJson["certificates"] = [];
  for (const l of seccion ?? []) {
    const t = sinVineta(l.trim());
    if (!t || t.length > 160) continue;
    const sola = RE_FECHA_SOLA.exec(prep(t).folded);
    const sinFecha = sola ? limpiarBordes(t.slice(0, sola.index) + " " + t.slice(sola.index + sola[0].length)) : t;
    // Con «|» las columnas son claras («Nombre - nivel | Emisor | 2024»); si no, separar por guion o coma.
    const [name, issuer] = (sinFecha.includes("|") ? sinFecha.split(/\s*\|\s*/) : sinFecha.split(/\s+(?:—|–|-|·)\s+|\s*,\s+/)).map(limpiarBordes);
    if (!name) continue;
    out.push({ name, ...(issuer ? { issuer } : {}), ...(sola ? { date: normalizarFecha(sola[1]) } : {}) });
  }
  return out.slice(0, 30);
}

const CAMPO_PROYECTO = /^(value|valor|description|descripcion|repository|repositorio|repo|link|url|demo|stack|tech stack|tecnologias|engineering outcome|engineering focus|outcome|resultado|impact|impacto)\s*:\s*/i;

/** Proyectos con campos etiquetados: «Nombre | Tipo», y debajo «Value:», «Repository:», «Stack:»… */
function proyectosConCampos(lineas: string[]): PerfilJson["projects"] {
  const out: { name: string; partes: string[]; url?: string }[] = [];
  let p: (typeof out)[number] | undefined;
  let continuaDescripcion = false;
  for (const crudo of lineas) {
    const l = sinVineta(crudo.trim());
    if (!l) continue;
    const m = CAMPO_PROYECTO.exec(l);
    if (m && p) {
      const resto = l.slice(m[0].length).trim();
      if (/^(repository|repositorio|repo|link|url|demo)$/i.test(m[1])) {
        const u = new RegExp(RE_URL.source, "i").exec(resto)?.[0];
        if (u) p.url = urlCompleta(u);
        continuaDescripcion = false;
      } else {
        p.partes.push(/stack|tecnolog/i.test(m[1]) ? `Stack: ${resto}` : resto);
        continuaDescripcion = true;
      }
    } else if (p && continuaDescripcion && !/\s\|\s/.test(l) && !/[.!?]$/.test(p.partes[p.partes.length - 1] ?? ".")) {
      p.partes[p.partes.length - 1] += ` ${l}`;
    } else {
      p = { name: limpiarBordes(l.split(/\s+\|\s+/)[0]), partes: [] };
      out.push(p);
      continuaDescripcion = false;
    }
  }
  return out
    .filter((x) => x.name)
    .map((x) => ({ name: x.name, ...(x.partes.length ? { description: x.partes.join(" ") } : {}), ...(x.url ? { url: x.url } : {}) }))
    .slice(0, 20);
}

function leerProyectos(seccion: string[] | undefined): PerfilJson["projects"] {
  if (seccion?.some((l) => CAMPO_PROYECTO.test(sinVineta(l.trim())))) return proyectosConCampos(seccion);
  const out: PerfilJson["projects"] = [];
  for (const l of seccion ?? []) {
    const t = l.trim();
    if (!t) continue;
    const url = new RegExp(RE_URL.source, "i").exec(t)?.[0];
    const sinUrl = url ? limpiarBordes(t.replace(url, " ")) : t;
    if (esVineta(t) && out.length && !/[:—–]/.test(sinVineta(sinUrl))) {
      const p = out[out.length - 1];
      p.description = p.description ? `${p.description} ${sinVineta(sinUrl)}` : sinVineta(sinUrl);
      continue;
    }
    const [name, ...desc] = sinVineta(sinUrl).split(/\s*[:—–]\s+|\s+-\s+/);
    if (!name) continue;
    out.push({ name: limpiarBordes(name), ...(desc.length ? { description: desc.join(" — ") } : {}), ...(url ? { url: urlCompleta(url) } : {}) });
  }
  return out.slice(0, 20);
}

// ---------------------------------------------------------------------------------------------------------------

/** Convierte el texto limpio de un CV en un perfil estructurado. Determinista: no usa servicios externos. */
export function leerPerfil(texto: string): ResultadoLectura {
  const { cabecera, secciones } = partirEnSecciones(texto);
  const basics = leerBasicos(cabecera, texto);
  const resumen = secciones.get("resumen")?.map((l) => l.trim()).filter(Boolean);
  if (resumen?.length) basics.summary = resumen.map(sinVineta).join(" ");

  const perfil: PerfilJson = {
    basics,
    work: leerExperiencia(secciones.get("experiencia") ?? []),
    education: leerEducacion(secciones.get("educacion") ?? []),
    skills: leerHabilidades(texto, secciones.get("habilidades")),
    languages: leerIdiomas(secciones.get("idiomas"), texto),
    certificates: leerCertificaciones(secciones.get("certificaciones")),
    projects: leerProyectos(secciones.get("proyectos")),
  };

  const faltantes: CampoClave[] = [];
  if (!basics.name) faltantes.push("nombre");
  if (!basics.email) faltantes.push("correo");
  if (!basics.phone) faltantes.push("telefono");
  if (!perfil.work.length) faltantes.push("experiencia");
  if (!perfil.education.length) faltantes.push("educacion");
  if (!perfil.skills.length) faltantes.push("habilidades");
  return { perfil, faltantes };
}

// ---------------------------------------------------------------------------------------------------------------
// Validación de lo que llega del navegador o de la base

const LIM = { corto: 200, medio: 500, largo: 4000, lista: 60 };

function cad(x: unknown, max: number): string | undefined {
  return typeof x === "string" && x.trim() ? x.trim().slice(0, max) : undefined;
}

function fecha(x: unknown): string | undefined {
  return typeof x === "string" && /^(?:19|20)\d{2}(?:-(?:0[1-9]|1[0-2]))?$/.test(x) ? x : undefined;
}

function lista<T>(x: unknown, fn: (o: Record<string, unknown>) => T | undefined, max = LIM.lista): T[] {
  if (!Array.isArray(x)) return [];
  const out: T[] = [];
  for (const it of x) {
    if (out.length >= max) break;
    if (typeof it !== "object" || it === null) continue;
    const v = fn(it as Record<string, unknown>);
    if (v !== undefined) out.push(v);
  }
  return out;
}

function sinVacios<T extends object>(o: T): T {
  return Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as T;
}

function urlHttp(x: unknown): string | undefined {
  const s = cad(x, LIM.medio);
  if (!s) return undefined;
  try {
    const u = new URL(s);
    return u.protocol === "http:" || u.protocol === "https:" ? s : undefined;
  } catch {
    return undefined;
  }
}

export function sanitizarPerfilJson(crudo: unknown): PerfilJson {
  if (typeof crudo !== "object" || crudo === null) return perfilVacio();
  const o = crudo as Record<string, unknown>;
  const b = (typeof o.basics === "object" && o.basics !== null ? o.basics : {}) as Record<string, unknown>;
  const loc = (typeof b.location === "object" && b.location !== null ? b.location : undefined) as Record<string, unknown> | undefined;
  const location = loc ? sinVacios({ city: cad(loc.city, LIM.corto), region: cad(loc.region, LIM.corto), countryCode: cad(loc.countryCode, 2)?.toUpperCase() }) : undefined;
  const correo = cad(b.email, LIM.corto);
  return {
    basics: sinVacios({
      name: cad(b.name, LIM.corto) ?? "",
      label: cad(b.label, LIM.corto),
      email: correo && RE_CORREO.test(correo) ? correo : undefined,
      phone: cad(b.phone, 40),
      url: urlHttp(b.url),
      summary: cad(b.summary, LIM.largo),
      location: location && Object.keys(location).length ? location : undefined,
      profiles: lista(b.profiles, (p) => {
        const url = urlHttp(p.url);
        return url ? sinVacios({ network: cad(p.network, 40) ?? "", url, username: cad(p.username, 80) }) : undefined;
      }, 10),
    }),
    work: lista(o.work, (w) =>
      sinVacios({
        name: cad(w.name, LIM.corto),
        position: cad(w.position, LIM.corto),
        location: cad(w.location, LIM.corto),
        startDate: fecha(w.startDate),
        endDate: fecha(w.endDate),
        summary: cad(w.summary, LIM.largo),
        highlights: Array.isArray(w.highlights) ? w.highlights.map((h) => cad(h, LIM.medio)).filter((h): h is string => !!h).slice(0, 20) : [],
      }),
    ),
    education: lista(o.education, (e) => {
      const r = sinVacios({ institution: cad(e.institution, LIM.corto), area: cad(e.area, LIM.corto), studyType: cad(e.studyType, LIM.corto), startDate: fecha(e.startDate), endDate: fecha(e.endDate) });
      return Object.keys(r).length ? r : undefined;
    }, 20),
    skills: lista(o.skills, (s) => {
      const name = cad(s.name, 80);
      const keywords = Array.isArray(s.keywords) ? s.keywords.map((k) => cad(k, 60)).filter((k): k is string => !!k).slice(0, 60) : [];
      return name ? { name, keywords } : undefined;
    }, 30),
    languages: lista(o.languages, (l) => {
      const language = cad(l.language, 60);
      return language ? sinVacios({ language, fluency: cad(l.fluency, 60) }) : undefined;
    }, 15),
    certificates: lista(o.certificates, (c) => {
      const name = cad(c.name, LIM.corto);
      return name ? sinVacios({ name, issuer: cad(c.issuer, LIM.corto), date: fecha(c.date) }) : undefined;
    }, 30),
    projects: lista(o.projects, (p) => {
      const name = cad(p.name, LIM.corto);
      return name ? sinVacios({ name, description: cad(p.description, LIM.largo), url: urlHttp(p.url) }) : undefined;
    }, 20),
  };
}
