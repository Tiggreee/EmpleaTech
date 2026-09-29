import { analizar } from "../analisis/analizador";
import { resumir, type ResumenAnalisis } from "../analisis/resumen";
import { detectarIdioma, prep } from "../analisis/texto";
import { ETIQUETAS, type Respuestas } from "../perfil/respuestas";
import { detectarAlertas } from "../radar/radar";
import { prioridadDeResumen, type Prioridad } from "../seguimiento/prioridad";
import type { Consulta, ContextoFuente, FuenteVacantes } from "./fuentes";
import { claveDuplicado, type FuenteId, type Vacante } from "./vacante";

export interface ResultadoFuente {
  fuente: FuenteId;
  estado: "ok" | "error" | "omitida";
  encontradas: number;
  /** Cuántas pasaron los filtros (palabras, remoto, países). */
  aceptadas: number;
  detalle?: string;
}

export interface VacantePuntuada {
  vacante: Vacante;
  resumen: ResumenAnalisis;
  prioridad: Prioridad;
}

// ---------------------------------------------------------------------------------------------------------------
// Filtros

/** Palabras en minúsculas y sin acentos, sin repetir. */
export function normalizarPalabras(palabras: string[]): string[] {
  return [...new Set(palabras.map((p) => prep(p).folded.trim().replace(/\s+/g, " ")).filter((p) => p.length >= 2))].slice(0, 12);
}

/** Equivalencias español → inglés a nivel de palabra, para que «Desarrolladora Backend» encuentre «Backend Developer». */
const EQUIVALENTE: Record<string, string> = {
  desarrollador: "developer", desarrolladora: "developer", programador: "developer", programadora: "developer", programmer: "developer", dev: "developer",
  ingeniero: "engineer", ingeniera: "engineer", analista: "analyst", datos: "data", disenador: "designer", disenadora: "designer",
  gerente: "manager", cientifico: "scientist", cientifica: "scientist", soporte: "support", ventas: "sales", producto: "product",
  proyecto: "project", proyectos: "project", seguridad: "security", nube: "cloud", movil: "mobile", pruebas: "qa", calidad: "qa",
  redes: "network", sistemas: "systems", contador: "accountant", contadora: "accountant", reclutador: "recruiter", reclutadora: "recruiter",
};
/** Palabras demasiado generales: solo cuentan si la búsqueda no trae nada más específico. */
const GENERICAS = new Set(["developer", "engineer", "specialist", "especialista"]);
const VACIAS = new Set(["de", "del", "en", "y", "e", "la", "el", "of", "the", "and", "for", "para", "con", "a"]);

function tokens(texto: string): string[] {
  return prep(texto)
    .folded.replace(/\b(back|front)[\s-]+end\b/g, "$1end")
    .replace(/\bfull[\s-]+stack\b/g, "fullstack")
    .replace(/\bdev[\s-]+ops\b/g, "devops")
    .replace(/[^a-z0-9+#.]+/g, " ")
    .split(" ")
    .map((w) => w.replace(/\.+$/, ""))
    .filter((w) => w && !VACIAS.has(w))
    .map((w) => EQUIVALENTE[w] ?? w);
}

/** La palabra más específica de una búsqueda («Desarrolladora Backend» → «backend»), para APIs que filtran por etiqueta. */
export function palabraClave(busqueda: string): string | undefined {
  const t = tokens(busqueda);
  return t.find((w) => !GENERICAS.has(w)) ?? t[0];
}

/**
 * Una búsqueda coincide si todas sus palabras importantes aparecen (en cualquier orden) en el título o las etiquetas.
 * Basta con que coincida una de las búsquedas.
 */
export function coincidePalabras(v: Vacante, palabras: string[]): boolean {
  if (!palabras.length) return true;
  const texto = new Set(tokens(`${v.titulo} ${v.etiquetas.join(" ")}`));
  return palabras.some((p) => {
    const t = tokens(p);
    const especificas = t.filter((w) => !GENERICAS.has(w));
    const requeridas = especificas.length ? especificas : t;
    return requeridas.length > 0 && requeridas.every((w) => texto.has(w));
  });
}

export function pasaFiltros(v: Vacante, c: Pick<Consulta, "soloRemoto" | "paises">): { ok: boolean; motivo?: string } {
  if (c.soloRemoto && v.modalidad && v.modalidad !== "remoto") return { ok: false, motivo: "no es remota" };
  if (c.paises.length && v.paises.length && !v.paises.some((p) => c.paises.includes(p))) {
    return { ok: false, motivo: `solo para ${v.paises.slice(0, 4).join(", ")}` };
  }
  return { ok: true };
}

/** Quita la misma vacante publicada en varias plataformas; conserva la que lleva directo al formulario de la empresa. */
export function deduplicar(vacantes: Vacante[]): Vacante[] {
  const mejor = new Map<string, Vacante>();
  for (const v of vacantes) {
    const clave = claveDuplicado(v);
    const previa = mejor.get(clave);
    if (!previa || (!previa.ats && v.ats) || (!previa.salario && v.salario && !!previa.ats === !!v.ats)) mejor.set(clave, v);
  }
  return [...mejor.values()];
}

// ---------------------------------------------------------------------------------------------------------------
// Puntaje

const NIVEL_ALTO = /\b(senior|sr|staff|principal|lead|l[ií]der|head|architect|arquitect[oa])\b/;
const NIVEL_ENTRADA = /\b(junior|jr|intern|internship|trainee|practicante|becari[oa]|entry level|entry-level)\b/;

/**
 * Identifica con qué CV y respuestas se calculó un puntaje: si cambian, las vacantes guardadas se vuelven a puntuar.
 * FNV-1a de 32 bits: basta para detectar cambios, no es criptográfico.
 */
export function huellaPuntaje(cv: { id: string; actualizadoEn: string }, respuestas: Respuestas, extra = ""): string {
  let h = 0x811c9dc5;
  for (const c of JSON.stringify(respuestas) + extra) {
    h ^= c.charCodeAt(0);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return `${cv.id}|${cv.actualizadoEn}|${h.toString(16)}`;
}

function textoParaAnalizar(v: Vacante): string {
  return `${v.titulo}\n${v.etiquetas.length ? `Requisitos: ${v.etiquetas.join(", ")}\n` : ""}${v.descripcion}`;
}

/**
 * Afinidad con el CV + radar de riesgos + tus preferencias, con cada factor explicado. `ajuste` es lo aprendido de tus
 * resultados (plataformas y niveles que te responden más o menos), ya acotado por quien lo calcula.
 */
export function puntuar(v: Vacante, cvTexto: string, respuestas: Respuestas, ahora: Date, ajuste?: { puntos: number; motivo: string } | null): VacantePuntuada {
  const texto = textoParaAnalizar(v);
  const resumen = resumir(analizar(cvTexto, texto, { ahora }), detectarAlertas(texto, ahora), ahora);
  const base = prioridadDeResumen(resumen);
  if (base.valor === null) return { vacante: v, resumen, prioridad: base };

  let valor = base.valor;
  const factores = [...base.factores];
  if (ajuste?.puntos) {
    valor += ajuste.puntos;
    factores.push(ajuste.motivo);
  }
  if (v.modalidad && respuestas.modalidades.length && !respuestas.modalidades.includes(v.modalidad)) {
    valor -= 15;
    factores.push(`Es ${ETIQUETAS.modalidad[v.modalidad].toLowerCase()} y tú buscas ${respuestas.modalidades.map((m) => ETIQUETAS.modalidad[m].toLowerCase()).join(" o ")} (−15)`);
  }
  if (v.paises.length && respuestas.paisesAutorizado.length && !v.paises.some((p) => respuestas.paisesAutorizado.includes(p))) {
    valor -= 25;
    factores.push(`Pide residir en ${v.paises.slice(0, 4).join(", ")} (−25)`);
  }
  const s = respuestas.salario;
  if (s && v.salario?.max && v.salario.moneda === s.moneda && v.salario.periodo === s.periodo && v.salario.max < s.monto * 0.8) {
    valor -= 10;
    factores.push(`Paga hasta ${v.salario.max.toLocaleString("es-MX")} ${v.salario.moneda}, por debajo de tu pretensión (−10)`);
  }
  // Nivel del puesto contra tus años de experiencia: los filtros automáticos descartan fuera de rango.
  const anios = respuestas.aniosExperiencia;
  const tituloPlegado = prep(v.titulo).folded;
  if (anios !== undefined && NIVEL_ALTO.test(tituloPlegado) && anios < 4) {
    valor -= 10;
    factores.push(`Pide nivel senior y tienes ${anios} año${anios === 1 ? "" : "s"} de experiencia (−10)`);
  } else if (anios !== undefined && NIVEL_ENTRADA.test(tituloPlegado) && anios >= 4) {
    valor -= 5;
    factores.push(`Es un puesto de entrada y tienes ${anios} años de experiencia (−5)`);
  }
  // Idioma de la vacante contra tu nivel de inglés.
  if (detectarIdioma(prep(`${v.titulo}\n${v.descripcion}`).folded) === "en") {
    if (respuestas.nivelIngles === "basico") {
      valor -= 20;
      factores.push("La vacante está en inglés y marcaste inglés básico (−20)");
    } else if (respuestas.nivelIngles === "intermedio") {
      valor -= 5;
      factores.push("La vacante está en inglés y marcaste inglés intermedio (−5)");
    }
  }

  const dias = v.publicadaEn ? Math.floor((ahora.getTime() - new Date(v.publicadaEn).getTime()) / 86_400_000) : 0;
  // En el tablero oficial de la empresa solo aparece lo que sigue abierto, aunque se haya publicado hace meses.
  const tableroOficial = v.fuente === "greenhouse" || v.fuente === "lever" || v.fuente === "ashby";
  if (dias > 30 && !tableroOficial) {
    valor -= 10;
    factores.push(`Publicada hace ${dias} días: puede estar cerrada (−10)`);
  } else if (v.publicadaEn && dias >= 0 && dias <= 3) {
    valor += 5;
    factores.push("Publicada hace menos de 4 días: postular pronto aumenta las respuestas (+5)");
  }

  valor = Math.max(0, Math.min(100, Math.round(valor)));
  let recomendacion = base.recomendacion;
  if (recomendacion === "postular" && valor < 70) recomendacion = "revisar";
  if (recomendacion !== "descartar" && valor < 25) recomendacion = "descartar";
  return { vacante: v, resumen, prioridad: { valor, recomendacion, factores } };
}

export function ordenar(lista: VacantePuntuada[]): VacantePuntuada[] {
  return [...lista].sort((a, b) => (b.prioridad.valor ?? -1) - (a.prioridad.valor ?? -1) || (b.vacante.publicadaEn ?? "").localeCompare(a.vacante.publicadaEn ?? ""));
}

// ---------------------------------------------------------------------------------------------------------------
// Orquestación

export interface OpcionesBusqueda {
  /** Última consulta exitosa por fuente, para respetar el intervalo mínimo de cada una. */
  ultimaConsulta?: Partial<Record<FuenteId, Date>>;
  /** Ignora el intervalo mínimo (solo pruebas). */
  forzar?: boolean;
  timeoutMs?: number;
}

function conTiempoLimite<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`sin respuesta en ${Math.round(ms / 1000)} s`)), ms);
    p.then(
      (v) => {
        clearTimeout(t);
        resolve(v);
      },
      (e) => {
        clearTimeout(t);
        reject(e);
      },
    );
  });
}

/** Consulta las fuentes en paralelo; una que falle no tumba a las demás. */
export async function buscarVacantes(
  fuentes: FuenteVacantes[],
  consulta: Consulta,
  ctx: ContextoFuente,
  opciones: OpcionesBusqueda = {},
): Promise<{ vacantes: Vacante[]; reporte: ResultadoFuente[] }> {
  const palabras = normalizarPalabras(consulta.palabras);
  const c: Consulta = { ...consulta, palabras };

  const resultados = await Promise.all(
    fuentes.map(async (f): Promise<{ reporte: ResultadoFuente; vacantes: Vacante[] }> => {
      const base = { fuente: f.info.id, encontradas: 0, aceptadas: 0 };
      const faltan = f.info.claves.filter((k) => !ctx.claves[k]);
      if (faltan.length) return { reporte: { ...base, estado: "omitida", detalle: `requiere clave (${faltan.join(", ")})` }, vacantes: [] };
      if (f.info.necesitaEmpresas && !c.empresas[f.info.id as keyof Consulta["empresas"]]?.length) {
        return { reporte: { ...base, estado: "omitida", detalle: "no hay empresas configuradas" }, vacantes: [] };
      }
      const ultima = opciones.ultimaConsulta?.[f.info.id];
      const minutos = ultima ? (ctx.ahora.getTime() - ultima.getTime()) / 60_000 : Infinity;
      if (!opciones.forzar && minutos < f.info.intervaloMinutos) {
        const espera = Math.ceil(f.info.intervaloMinutos - minutos);
        return { reporte: { ...base, estado: "omitida", detalle: `consultada hace poco; disponible en ${espera} min` }, vacantes: [] };
      }
      try {
        const crudas = await conTiempoLimite(f.buscar(c, ctx), opciones.timeoutMs ?? 20_000);
        const aceptadas = crudas.filter((v) => coincidePalabras(v, palabras) && pasaFiltros(v, c).ok).slice(0, c.maxPorFuente);
        return { reporte: { ...base, estado: "ok", encontradas: crudas.length, aceptadas: aceptadas.length }, vacantes: aceptadas };
      } catch (e) {
        return { reporte: { ...base, estado: "error", detalle: e instanceof Error ? e.message.slice(0, 200) : "error desconocido" }, vacantes: [] };
      }
    }),
  );

  return { vacantes: deduplicar(resultados.flatMap((r) => r.vacantes)), reporte: resultados.map((r) => r.reporte) };
}
