import { detectarIdioma, prep } from "../analisis/texto";
import { ETIQUETAS, PREFIERO_NO_DECIR, fechaDeInicio, type Respuestas } from "../perfil/respuestas";
import { paisesDeTexto } from "../vacantes/paises";
import { NOMBRE_NIVEL, cumpleNivel, nivelQuePide, opcionDeNivel, type EstudiosForm } from "./estudios";

/** Qué dato del perfil va en cada campo de un formulario de postulación. */
export type Campo =
  | "nombreCompleto"
  | "nombre"
  | "apellido"
  | "nombrePreferido"
  | "correo"
  | "telefono"
  | "ciudad"
  | "ubicacion"
  | "paisResidencia"
  | "linkedin"
  | "github"
  | "twitter"
  | "portafolio"
  | "empresaActual"
  | "puestoActual"
  | "salario"
  | "fechaInicio"
  | "patrocinio"
  | "autorizacion"
  | "aniosExperiencia"
  | "ingles"
  | "reubicacion"
  | "tieneTitulo"
  | "nivelEstudios"
  | "escuela"
  | "carrera"
  | "anioGraduacion"
  | "carta"
  | "cv"
  | "genero"
  | "etnia"
  | "discapacidad"
  | "veterano";

export type IdiomaForm = "es" | "en";

export interface DatosAutollenado {
  nombre: string;
  apellido: string;
  nombreCompleto: string;
  correo?: string;
  telefono?: string;
  ciudad?: string;
  /** ISO-2 */
  paisResidencia?: string;
  linkedin?: string;
  github?: string;
  twitter?: string;
  portafolio?: string;
  empresaActual?: string;
  puestoActual?: string;
  aniosExperiencia?: number;
  /** Tu estudio terminado de mayor nivel (un bootcamp no cuenta como título). */
  estudios?: EstudiosForm;
  respuestas: Respuestas;
  carta?: string;
  cvTexto?: string;
  /** Respuestas que diste a mano en formularios anteriores: etiqueta normalizada → valor. */
  aprendidas: Record<string, string>;
}

// ---------------------------------------------------------------------------------------------------------------
// Clasificación

/** Nombre del campo en el HTML → campo, para los sistemas que usan nombres fijos (Greenhouse, Lever, Ashby). */
const POR_NOMBRE: Record<string, Campo> = {
  first_name: "nombre",
  last_name: "apellido",
  preferred_name: "nombrePreferido",
  email: "correo",
  phone: "telefono",
  name: "nombreCompleto",
  _systemfield_name: "nombreCompleto",
  _systemfield_email: "correo",
  _systemfield_phone: "telefono",
  _systemfield_resume: "cv",
  resume: "cv",
  resume_text: "cv",
  cover_letter: "carta",
  cover_letter_text: "carta",
  comments: "carta",
  org: "empresaActual",
  location: "ubicacion",
};

/** El orden importa: la primera regla que coincide gana («visa sponsorship» antes que «authorized to work»). */
const REGLAS: [Campo, RegExp][] = [
  ["nombrePreferido", /\b(preferred (first )?name|nombre preferido)\b/],
  ["nombre", /\b(first name|given name|primer nombre|nombre de pila)\b|^nombres?$/],
  ["apellido", /\b(last name|family name|surname|apellidos?)\b/],
  ["nombreCompleto", /\b(full name|nombre completo|your name|tu nombre)\b|^name$/],
  ["correo", /\b(e ?mail|correo)\b/],
  ["telefono", /\b(phone|telefono|celular|movil|whatsapp|mobile)\b/],
  ["linkedin", /\blinked ?in\b/],
  ["github", /\bgit ?hub\b/],
  ["twitter", /\b(twitter|x profile|perfil de x)\b/],
  ["portafolio", /\b(portfolio|portafolio|website|sitio web|personal site|pagina personal|pagina web)\b/],
  ["patrocinio", /\b(sponsor(ship)?|patrocinio|visa)\b/],
  ["autorizacion", /\b(authori[sz]ed to work|work authori[sz]ation|legally (able|eligible|authori[sz]ed|permitted)|right to work|eligible to work|autorizad[oa] para trabajar|permiso de trabajo|puedes trabajar legalmente)\b/],
  ["reubicacion", /\b(relocat\w*|reubica\w*|mudar(te|se)|cambiar de ciudad)\b/],
  [
    "tieneTitulo",
    /\b(do you (have|hold|possess)|have you (completed|earned|obtained|finished)|cuentas con|tienes|has (terminado|concluido))\b.*\b(degree|bachelor\w*|master\w*|diploma|ph ?d|titulo|licenciatura|maestria|doctorado|high school|preparatoria)\b/,
  ],
  [
    "nivelEstudios",
    /\b(highest (level of )?(education|degree|qualification)|education(al)? level|level of (education|study)|nivel (maximo )?(de )?estudios|nivel academico|grado (academico|maximo)|ultimo grado de estudios|escolaridad)\b|^(degree|degree type|titulo|grado|grado academico)$/,
  ],
  ["anioGraduacion", /\b(graduation (year|date)|year of graduation|year (you )?graduated|when did you graduate|ano de (graduacion|egreso)|fecha de (graduacion|egreso|titulacion))\b/],
  // «Carrera» sola también es «trayectoria» («cuéntanos de tu carrera»): solo cuando pregunta qué estudiaste.
  ["carrera", /\b(field of study|area of study|major|discipline|carrera universitaria|que carrera (estudiaste|cursaste)|nombre de la carrera|area de estudios?)\b/],
  ["escuela", /\b(school|university|college|alma mater|universidad|escuela|institucion educativa)\b/],
  ["salario", /\b(salary|compensation|pay expectations?|pretension\w*|expectativa salarial|sueldo|salario|remuneracion|rate expectations?)\b/],
  ["fechaInicio", /\b(start date|when can you start|earliest start|available to start|notice period|disponibilidad|fecha de (inicio|ingreso)|cuando (puedes|podrias) (empezar|iniciar))\b/],
  ["aniosExperiencia", /\b(years of (relevant |professional |work )?experience|how many years|anos de experiencia|cuantos anos)\b/],
  ["ingles", /\b(english|ingles)\b/],
  ["carta", /\b(cover letter|carta de (presentacion|motivacion)|motivation letter)\b/],
  ["cv", /\b(resume|curriculum|cv)\b/],
  ["empresaActual", /\b(current (company|employer)|empresa actual|empleador actual|most recent (company|employer))\b/],
  ["puestoActual", /\b(current (job )?(title|role|position)|puesto actual|cargo actual)\b/],
  ["genero", /\b(gender|genero|sexo)\b/],
  ["etnia", /\b(race|ethnicity|etnia|hispanic|latino)\b/],
  ["discapacidad", /\b(disability|discapacidad)\b/],
  ["veterano", /\b(veteran|veterano)\b/],
  ["paisResidencia", /\b(country of residence|pais de residencia|country you (live|reside) in|en que pais vives)\b|^(country|pais)$/],
  ["ciudad", /\b(city|ciudad)\b/],
  ["ubicacion", /\b(location|ubicacion|where are you (based|located)|donde (vives|resides)|current address|residencia)\b/],
];

const AÑOS_DE_ALGO =
  /\b(years? of (?!(relevant|professional|work|total|overall)\b)\w+( \w+)?( related)? experience|experience( do you have| you have| have you had)? (with|in|using|as|doing)\b|anos de experiencia (tienes )?(en|con|como|usando)\b)/;

/** «¿Cuál es tu LinkedIn? *» → «cual es tu linkedin»: sin acentos, signos ni asteriscos. */
export function normalizarEtiqueta(etiqueta: string): string {
  return prep(etiqueta)
    .folded.replace(/\((required|requerido|obligatorio|optional|opcional)\)/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .slice(0, 160);
}

export function clasificar(etiqueta: string, pistas: { nombre?: string; tipo?: string } = {}): Campo | null {
  const nombre = (pistas.nombre ?? "").toLowerCase();
  if (POR_NOMBRE[nombre]) return POR_NOMBRE[nombre];
  const url = /^urls\[(.+)\]$/.exec(nombre)?.[1];
  const e = normalizarEtiqueta(url ? `${url} ${etiqueta}` : etiqueta);
  if (e) {
    for (const [campo, re] of REGLAS) {
      if (!re.test(e)) continue;
      // «Años de experiencia en ventas / con Python»: tus años totales no responden eso; queda para ti.
      if (campo === "aniosExperiencia" && AÑOS_DE_ALGO.test(e)) return null;
      return campo;
    }
  }
  if (pistas.tipo === "email") return "correo";
  if (pistas.tipo === "tel") return "telefono";
  return null;
}

export function idiomaDelFormulario(etiquetas: string[]): IdiomaForm {
  return detectarIdioma(prep(etiquetas.join(" ")).folded) === "es" ? "es" : "en";
}

// ---------------------------------------------------------------------------------------------------------------
// Valores

const INGLES_EN = { basico: "Basic", intermedio: "Intermediate", avanzado: "Advanced", nativo: "Native or bilingual" } as const;
const DISPONIBLE = {
  es: { inmediata: "De inmediato", "2-semanas": "En 2 semanas", "1-mes": "En 1 mes" },
  en: { inmediata: "Immediately", "2-semanas": "In 2 weeks", "1-mes": "In 1 month" },
} as const;

function nombrePais(iso: string | undefined, idioma: IdiomaForm): string | undefined {
  if (!iso) return undefined;
  try {
    return new Intl.DisplayNames([idioma], { type: "region" }).of(iso) ?? iso;
  } catch {
    return iso;
  }
}

/** Valor para un campo de texto libre. undefined = no lo sabemos: se deja para ti. */
export function valorTexto(campo: Campo, d: DatosAutollenado, idioma: IdiomaForm, hoy: Date): string | undefined {
  const r = d.respuestas;
  switch (campo) {
    case "nombreCompleto":
      return d.nombreCompleto || undefined;
    case "nombre":
    case "nombrePreferido":
      return d.nombre || undefined;
    case "apellido":
      return d.apellido || undefined;
    case "correo":
      return d.correo;
    case "telefono":
      return d.telefono;
    case "ciudad":
      return d.ciudad;
    case "ubicacion":
      return [d.ciudad, nombrePais(d.paisResidencia, idioma)].filter(Boolean).join(", ") || undefined;
    case "paisResidencia":
      return nombrePais(d.paisResidencia, idioma);
    case "linkedin":
      return d.linkedin;
    case "github":
      return d.github;
    case "twitter":
      return d.twitter;
    case "portafolio":
      return d.portafolio;
    case "empresaActual":
      return d.empresaActual;
    case "puestoActual":
      return d.puestoActual;
    case "salario": {
      const s = r.salario;
      if (!s) return undefined;
      const periodo = idioma === "es" ? ETIQUETAS.periodo[s.periodo] : { mes: "per month", año: "per year", hora: "per hour" }[s.periodo];
      return `${s.monto.toLocaleString(idioma === "es" ? "es-MX" : "en-US")} ${s.moneda} ${periodo}`;
    }
    case "fechaInicio":
      if (!r.disponibilidad) return undefined;
      return r.disponibilidad === "fecha" ? fechaDeInicio(r, hoy) : DISPONIBLE[idioma][r.disponibilidad];
    case "aniosExperiencia": {
      const n = r.aniosExperiencia ?? d.aniosExperiencia;
      return n === undefined ? undefined : String(n);
    }
    case "ingles":
      return r.nivelIngles ? (idioma === "es" ? ETIQUETAS.ingles[r.nivelIngles] : INGLES_EN[r.nivelIngles]) : undefined;
    case "carta":
      return d.carta;
    case "cv":
      return d.cvTexto;
    case "nivelEstudios":
      return d.estudios ? NOMBRE_NIVEL[idioma][d.estudios.nivel] : undefined;
    case "escuela":
      return d.estudios?.escuela;
    case "carrera":
      return d.estudios?.carrera;
    case "anioGraduacion":
      return d.estudios?.anioFin;
    default:
      return undefined;
  }
}

/** Sí/No para las preguntas cerradas. undefined = no lo sabemos. */
export function valorSiNo(campo: Campo, d: DatosAutollenado, etiqueta: string): boolean | undefined {
  const r = d.respuestas;
  const paisesPregunta = paisesDeTexto(etiqueta).paises;
  const autorizadoAhi = paisesPregunta.length ? paisesPregunta.some((p) => r.paisesAutorizado.includes(p)) : undefined;
  switch (campo) {
    case "autorizacion":
      // Solo si la pregunta dice de qué país habla; «¿puedes trabajar aquí?» sin país se deja para ti.
      return autorizadoAhi;
    case "patrocinio":
      if (autorizadoAhi === true) return false;
      return r.requierePatrocinio;
    case "reubicacion":
      return r.reubicacion;
    case "tieneTitulo": {
      // Sin título detectado no se contesta «no»: puede que tu CV simplemente no lo diga.
      const pide = nivelQuePide(etiqueta);
      return pide && d.estudios ? cumpleNivel(d.estudios.nivel, pide) : undefined;
    }
    default:
      return undefined;
  }
}

const SI = /^\s*(yes|si|sí|y)\b/i;
const NO = /^\s*(no|n)\b/i;
const DECLINAR = /(decline|prefer not|don.?t wish|do not wish|not (to )?(answer|disclose|self.?identify)|prefiero no|no deseo|no quiero (responder|decir)|rather not)/i;
const NIVELES_INGLES: Record<string, RegExp> = {
  basico: /(basic|basico|elementary|beginner|a1|a2)/i,
  intermedio: /(intermediate|intermedio|conversational|b1|b2)/i,
  avanzado: /(advanced|avanzado|fluent|fluido|professional|c1)/i,
  nativo: /(native|nativo|bilingual|bilingue|c2)/i,
};

/** Índice de la opción a elegir en un select o grupo de radios; -1 si no sabemos cuál. */
export function elegirOpcion(campo: Campo | null, d: DatosAutollenado, etiqueta: string, opciones: string[]): number {
  const aprendida = d.aprendidas[normalizarEtiqueta(etiqueta)];
  if (aprendida !== undefined) {
    const i = opciones.findIndex((o) => normalizarEtiqueta(o) === normalizarEtiqueta(aprendida));
    if (i >= 0) return i;
  }
  if (!campo) return -1;
  const siNo = valorSiNo(campo, d, etiqueta);
  if (siNo !== undefined) return opciones.findIndex((o) => (siNo ? SI : NO).test(o));

  const r = d.respuestas;
  switch (campo) {
    case "genero":
    case "etnia":
    case "discapacidad":
    case "veterano": {
      const valor = r.diversidad[campo];
      if (valor === PREFIERO_NO_DECIR) return opciones.findIndex((o) => DECLINAR.test(o));
      return opciones.findIndex((o) => normalizarEtiqueta(o) === normalizarEtiqueta(valor));
    }
    case "ingles":
      return r.nivelIngles ? opciones.findIndex((o) => NIVELES_INGLES[r.nivelIngles as string].test(o)) : -1;
    case "paisResidencia": {
      if (!d.paisResidencia) return -1;
      const nombres = (["en", "es"] as const).map((l) => normalizarEtiqueta(nombrePais(d.paisResidencia, l) ?? ""));
      return opciones.findIndex((o) => nombres.includes(normalizarEtiqueta(o)) || o.trim().toUpperCase() === d.paisResidencia);
    }
    case "aniosExperiencia": {
      const n = r.aniosExperiencia ?? d.aniosExperiencia;
      if (n === undefined) return -1;
      // Rangos como «0-1», «2 - 4 years», «5+», «More than 10».
      return opciones.findIndex((o) => {
        const nums = (o.match(/\d+/g) ?? []).map(Number);
        if (!nums.length) return false;
        if (/\+|more|mas|or more|o mas/i.test(o)) return n >= nums[0];
        if (/less|menos|under/i.test(o)) return n < nums[0];
        return nums.length >= 2 ? n >= nums[0] && n <= nums[1] : n === nums[0];
      });
    }
    case "nivelEstudios":
      return d.estudios ? opcionDeNivel(d.estudios.nivel, opciones) : -1;
    case "escuela":
    case "carrera": {
      const valor = campo === "escuela" ? d.estudios?.escuela : d.estudios?.carrera;
      return valor ? opciones.findIndex((o) => normalizarEtiqueta(o) === normalizarEtiqueta(valor)) : -1;
    }
    default:
      return -1;
  }
}
