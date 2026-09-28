/**
 * Respuestas que casi todos los formularios de postulación piden. Se contestan una sola vez y después se reutilizan
 * para llenar formularios. Nada aquí es obligatorio: lo que falte se pregunta cuando haga falta.
 */

export const MONEDAS = ["MXN", "USD", "EUR", "COP", "ARS", "CLP", "PEN", "BRL", "UYU", "GTQ", "CRC", "DOP"] as const;
export type Moneda = (typeof MONEDAS)[number];

export const PERIODOS = ["mes", "año", "hora"] as const;
export type Periodo = (typeof PERIODOS)[number];

export const MODALIDADES = ["remoto", "hibrido", "presencial"] as const;
export type Modalidad = (typeof MODALIDADES)[number];

export const DISPONIBILIDADES = ["inmediata", "2-semanas", "1-mes", "fecha"] as const;
export type Disponibilidad = (typeof DISPONIBILIDADES)[number];

export const NIVELES_INGLES = ["basico", "intermedio", "avanzado", "nativo"] as const;
export type NivelIngles = (typeof NIVELES_INGLES)[number];

/** Valor por defecto en las preguntas voluntarias de diversidad de formularios de EE. UU. */
export const PREFIERO_NO_DECIR = "Prefiero no decir";

export const ETIQUETAS = {
  modalidad: { remoto: "Remoto", hibrido: "Híbrido", presencial: "Presencial" } satisfies Record<Modalidad, string>,
  disponibilidad: { inmediata: "Inmediata", "2-semanas": "En 2 semanas", "1-mes": "En 1 mes", fecha: "A partir de una fecha" } satisfies Record<Disponibilidad, string>,
  ingles: { basico: "Básico", intermedio: "Intermedio", avanzado: "Avanzado", nativo: "Nativo o bilingüe" } satisfies Record<NivelIngles, string>,
  periodo: { mes: "al mes", año: "al año", hora: "por hora" } satisfies Record<Periodo, string>,
};

export interface Salario {
  monto: number;
  moneda: Moneda;
  periodo: Periodo;
}

export interface Diversidad {
  genero: string;
  etnia: string;
  discapacidad: string;
  veterano: string;
}

export interface Respuestas {
  salario?: Salario;
  disponibilidad?: Disponibilidad;
  /** AAAA-MM-DD; solo cuando disponibilidad es «fecha». */
  fechaInicio?: string;
  modalidades: Modalidad[];
  reubicacion?: boolean;
  /** Países (ISO-2) donde puedes trabajar legalmente sin patrocinio. */
  paisesAutorizado: string[];
  requierePatrocinio?: boolean;
  aniosExperiencia?: number;
  nivelIngles?: NivelIngles;
  diversidad: Diversidad;
}

export const RESPUESTAS_VACIAS: Respuestas = {
  modalidades: [],
  paisesAutorizado: [],
  diversidad: { genero: PREFIERO_NO_DECIR, etnia: PREFIERO_NO_DECIR, discapacidad: PREFIERO_NO_DECIR, veterano: PREFIERO_NO_DECIR },
};

export type PreguntaClave = "salario" | "disponibilidad" | "modalidades" | "paisesAutorizado" | "requierePatrocinio" | "aniosExperiencia" | "nivelIngles";

export const TEXTO_PREGUNTA: Record<PreguntaClave, string> = {
  salario: "Pretensión salarial",
  disponibilidad: "Cuándo puedes empezar",
  modalidades: "Modalidades que aceptas",
  paisesAutorizado: "Países donde puedes trabajar",
  requierePatrocinio: "Si necesitas patrocinio de visa",
  aniosExperiencia: "Años de experiencia",
  nivelIngles: "Nivel de inglés",
};

/** Preguntas frecuentes que aún no tienen respuesta, en el orden en que conviene contestarlas. */
export function pendientes(r: Respuestas): PreguntaClave[] {
  const faltan: PreguntaClave[] = [];
  if (!r.salario) faltan.push("salario");
  if (!r.disponibilidad || (r.disponibilidad === "fecha" && !r.fechaInicio)) faltan.push("disponibilidad");
  if (!r.modalidades.length) faltan.push("modalidades");
  if (!r.paisesAutorizado.length) faltan.push("paisesAutorizado");
  if (r.requierePatrocinio === undefined) faltan.push("requierePatrocinio");
  if (r.aniosExperiencia === undefined) faltan.push("aniosExperiencia");
  if (!r.nivelIngles) faltan.push("nivelIngles");
  return faltan;
}

/** Fecha concreta de inicio para formularios que piden una fecha (AAAA-MM-DD). */
export function fechaDeInicio(r: Respuestas, hoy: Date): string | undefined {
  const mas = (dias: number) => new Date(hoy.getTime() + dias * 86_400_000).toISOString().slice(0, 10);
  switch (r.disponibilidad) {
    case "inmediata":
      return mas(0);
    case "2-semanas":
      return mas(14);
    case "1-mes":
      return mas(30);
    case "fecha":
      return r.fechaInicio;
    default:
      return undefined;
  }
}

function de<T extends string>(opciones: readonly T[], x: unknown): T | undefined {
  return typeof x === "string" && (opciones as readonly string[]).includes(x) ? (x as T) : undefined;
}

function bool(x: unknown): boolean | undefined {
  return typeof x === "boolean" ? x : undefined;
}

function textoCorto(x: unknown): string {
  return typeof x === "string" && x.trim() ? x.trim().slice(0, 80) : PREFIERO_NO_DECIR;
}

export function sanitizarRespuestas(crudo: unknown): Respuestas {
  if (typeof crudo !== "object" || crudo === null) return RESPUESTAS_VACIAS;
  const o = crudo as Record<string, unknown>;
  const r: Respuestas = { ...RESPUESTAS_VACIAS, diversidad: { ...RESPUESTAS_VACIAS.diversidad } };

  const s = o.salario as Record<string, unknown> | undefined;
  if (s && typeof s === "object" && typeof s.monto === "number" && Number.isFinite(s.monto) && s.monto > 0 && s.monto < 1e9) {
    const moneda = de(MONEDAS, s.moneda);
    const periodo = de(PERIODOS, s.periodo);
    if (moneda && periodo) r.salario = { monto: Math.round(s.monto), moneda, periodo };
  }

  r.disponibilidad = de(DISPONIBILIDADES, o.disponibilidad);
  if (r.disponibilidad === "fecha" && typeof o.fechaInicio === "string" && /^\d{4}-\d{2}-\d{2}$/.test(o.fechaInicio) && !Number.isNaN(Date.parse(o.fechaInicio))) {
    r.fechaInicio = o.fechaInicio;
  }

  r.modalidades = Array.isArray(o.modalidades) ? [...new Set(o.modalidades.map((m) => de(MODALIDADES, m)).filter((m): m is Modalidad => !!m))] : [];
  r.reubicacion = bool(o.reubicacion);
  r.paisesAutorizado = Array.isArray(o.paisesAutorizado)
    ? [...new Set(o.paisesAutorizado.filter((p): p is string => typeof p === "string" && /^[a-z]{2}$/i.test(p)).map((p) => p.toUpperCase()))].slice(0, 30)
    : [];
  r.requierePatrocinio = bool(o.requierePatrocinio);
  if (typeof o.aniosExperiencia === "number" && Number.isFinite(o.aniosExperiencia) && o.aniosExperiencia >= 0 && o.aniosExperiencia <= 60) {
    r.aniosExperiencia = Math.round(o.aniosExperiencia * 2) / 2;
  }
  r.nivelIngles = de(NIVELES_INGLES, o.nivelIngles);

  const d = o.diversidad as Record<string, unknown> | undefined;
  if (d && typeof d === "object") {
    r.diversidad = { genero: textoCorto(d.genero), etnia: textoCorto(d.etnia), discapacidad: textoCorto(d.discapacidad), veterano: textoCorto(d.veterano) };
  }

  // Sin claves con undefined: así el JSON guardado es estable.
  return Object.fromEntries(Object.entries(r).filter(([, v]) => v !== undefined)) as unknown as Respuestas;
}
