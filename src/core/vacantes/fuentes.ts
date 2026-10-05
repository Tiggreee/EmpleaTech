import type { FuenteId, Vacante } from "./vacante";

/** Plataformas que publican el tablero de empleos de cada empresa (hay que decirles qué empresas consultar). */
export type FuenteDeEmpresas = Extract<FuenteId, "greenhouse" | "lever" | "ashby">;

export interface Consulta {
  /** Palabras del puesto buscado («backend», «node», «data analyst»…). Basta con que coincida una. */
  palabras: string[];
  soloRemoto: boolean;
  /** Deja fuera becas, prácticas y puestos junior (para quien ya tiene experiencia). */
  ocultarEntrada?: boolean;
  /** Países (ISO-2) donde la persona puede trabajar; vacantes restringidas a otros países se descartan. */
  paises: string[];
  /** Tableros de empresas a revisar en las fuentes que lo necesitan. */
  empresas: Partial<Record<FuenteDeEmpresas, string[]>>;
  maxPorFuente: number;
}

/** Puerto de salida HTTP: los adaptadores no saben si hablan con internet o con datos de prueba. */
export interface Http {
  json(url: string, init?: { headers?: Record<string, string>; method?: "GET" | "POST"; body?: string }): Promise<unknown>;
}

export interface ContextoFuente {
  http: Http;
  /** Claves de API leídas del entorno (solo para las fuentes que las piden). */
  claves: Record<string, string | undefined>;
  ahora: Date;
}

export interface InfoFuente {
  id: FuenteId;
  nombre: string;
  sitio: string;
  descripcion: string;
  alcance: "latam" | "remoto" | "europa" | "eeuu" | "empresas" | "freelance";
  /** Proyectos freelance: no cuentan contra el tope de plataformas de empleo y se ganan con propuesta. */
  freelance?: boolean;
  /** Variables de entorno necesarias; sin ellas la fuente aparece como «requiere clave». */
  claves: string[];
  /** Tiempo mínimo entre consultas, para respetar los términos de uso de cada plataforma. */
  intervaloMinutos: number;
  necesitaEmpresas?: boolean;
}

/** Contrato que cumple cada plataforma (patrón puertos y adaptadores). */
export interface FuenteVacantes {
  info: InfoFuente;
  buscar(consulta: Consulta, ctx: ContextoFuente): Promise<Vacante[]>;
}

export const INFO_FUENTES: Record<FuenteId, InfoFuente> = {
  getonboard: {
    id: "getonboard",
    nombre: "Get on Board",
    sitio: "https://www.getonbrd.com",
    descripcion: "Empleos de tecnología en LatAm, muchas con salario publicado y en español.",
    alcance: "latam",
    claves: [],
    intervaloMinutos: 60,
  },
  remotive: {
    id: "remotive",
    nombre: "Remotive",
    sitio: "https://remotive.com",
    descripcion: "Empleos 100% remotos; llegan con 24 h de retraso. Pide consultar como máximo 4 veces al día.",
    alcance: "remoto",
    claves: [],
    intervaloMinutos: 360,
  },
  remoteok: {
    id: "remoteok",
    nombre: "Remote OK",
    sitio: "https://remoteok.com",
    descripcion: "Empleos remotos de tecnología, muchos con rango salarial en USD.",
    alcance: "remoto",
    claves: [],
    intervaloMinutos: 120,
  },
  jobicy: {
    id: "jobicy",
    nombre: "Jobicy",
    sitio: "https://jobicy.com",
    descripcion: "Empleos remotos; muchos marcados para LatAm.",
    alcance: "remoto",
    claves: [],
    intervaloMinutos: 120,
  },
  himalayas: {
    id: "himalayas",
    nombre: "Himalayas",
    sitio: "https://himalayas.app",
    descripcion: "Empleos remotos con restricciones de país y huso horario claras.",
    alcance: "remoto",
    claves: [],
    intervaloMinutos: 120,
  },
  arbeitnow: {
    id: "arbeitnow",
    nombre: "Arbeitnow",
    sitio: "https://www.arbeitnow.com",
    descripcion: "Empleos en Europa (sobre todo Alemania), varios remotos o con visa.",
    alcance: "europa",
    claves: [],
    intervaloMinutos: 120,
  },
  greenhouse: {
    id: "greenhouse",
    nombre: "Greenhouse",
    sitio: "https://www.greenhouse.com",
    descripcion: "Tableros oficiales de empresas que contratan con Greenhouse. Postulación directa, sin intermediarios.",
    alcance: "empresas",
    claves: [],
    intervaloMinutos: 60,
    necesitaEmpresas: true,
  },
  lever: {
    id: "lever",
    nombre: "Lever",
    sitio: "https://www.lever.co",
    descripcion: "Tableros oficiales de empresas que contratan con Lever. Postulación directa.",
    alcance: "empresas",
    claves: [],
    intervaloMinutos: 60,
    necesitaEmpresas: true,
  },
  ashby: {
    id: "ashby",
    nombre: "Ashby",
    sitio: "https://www.ashbyhq.com",
    descripcion: "Tableros oficiales de empresas que contratan con Ashby, casi siempre con salario publicado.",
    alcance: "empresas",
    claves: [],
    intervaloMinutos: 60,
    necesitaEmpresas: true,
  },
  adzuna: {
    id: "adzuna",
    nombre: "Adzuna",
    sitio: "https://www.adzuna.com",
    descripcion: "Buscador grande con México y Brasil. Requiere una clave gratuita de developer.adzuna.com.",
    alcance: "latam",
    claves: ["ADZUNA_APP_ID", "ADZUNA_APP_KEY"],
    intervaloMinutos: 30,
  },
  jooble: {
    id: "jooble",
    nombre: "Jooble",
    sitio: "https://jooble.org",
    descripcion: "Agregador con cobertura en LatAm. Requiere una clave gratuita de jooble.org/api/about.",
    alcance: "latam",
    claves: ["JOOBLE_API_KEY"],
    intervaloMinutos: 30,
  },
  usajobs: {
    id: "usajobs",
    nombre: "USAJOBS",
    sitio: "https://www.usajobs.gov",
    descripcion: "Empleos del gobierno de EE. UU. (piden ciudadanía o residencia). Requiere clave gratuita de developer.usajobs.gov.",
    alcance: "eeuu",
    claves: ["USAJOBS_API_KEY", "USAJOBS_EMAIL"],
    intervaloMinutos: 60,
  },
  freelancer: {
    id: "freelancer",
    nombre: "Freelancer.com",
    sitio: "https://www.freelancer.com",
    descripcion: "Proyectos freelance de todo el mundo, con presupuesto y cuántas propuestas llevan. Omitimos los de menos de US$100 o US$10/h.",
    alcance: "freelance",
    claves: [],
    intervaloMinutos: 60,
    freelance: true,
  },
  braintrust: {
    id: "braintrust",
    nombre: "Braintrust",
    sitio: "https://www.usebraintrust.com",
    descripcion: "Proyectos de tecnología bien pagados, muchos abiertos a LatAm. Pide un perfil aprobado para proponer.",
    alcance: "freelance",
    claves: [],
    intervaloMinutos: 180,
    freelance: true,
  },
};

/** Máximo de plataformas de empleo activas a la vez: el usuario elige las que más le sirven. Las de freelance van aparte. */
export const MAX_FUENTES_ACTIVAS = 5;

export const esFuenteFreelance = (id: FuenteId): boolean => INFO_FUENTES[id]?.freelance === true;
