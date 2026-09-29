import { APP_PROFILE_ID } from "@/config/app";
import { aniosDeExperiencia, perfilATexto, prepararDocumentos, type IdiomaDoc } from "@/core/documentos/aMedida";
import { cvATexto } from "@/core/documentos/formato";
import { detectarIdioma, prep } from "@/core/analisis/texto";
import type { DatosAutollenado } from "@/core/autollenado/campos";
import { claveDePostulacion, clavesDeVacante } from "@/core/autollenado/url";
import type { PerfilJson } from "@/core/perfil/estructurado";
import { cvActivo, estructuradoDe } from "@/core/perfil/perfil";
import { SELLO_ITEMS, analizarOferta, crear, marcarPostulada } from "@/core/seguimiento/seguimiento";
import type { Vacante } from "@/core/vacantes/vacante";
import { loadState, saveState } from "./app-state";
import { getPool } from "./db";
import { cartaAPdf, cvAPdf } from "./pdf";
import { ErrorVacantes } from "./vacantes";

export interface ArchivoBase64 {
  nombre: string;
  tipo: "application/pdf";
  base64: string;
}

export interface RespuestaAutollenado {
  datos: DatosAutollenado;
  vacante?: { id: string; titulo: string; empresa: string };
  archivos: { cv?: ArchivoBase64; carta?: ArchivoBase64 };
}

const MAX_APRENDIDAS = 500;

/** Nombre de archivo sin caracteres raros: algunos ATS rechazan acentos o signos. */
function nombreArchivo(...partes: string[]): string {
  const base = partes
    .filter(Boolean)
    .join(" - ")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^A-Za-z0-9 .-]+/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 90);
  return `${base || "documento"}.pdf`;
}

async function vacantePorUrl(url: string): Promise<Vacante | undefined> {
  const clave = claveDePostulacion(url);
  if (!clave) return undefined;
  const { rows } = await getPool().query(`select datos_json from vacantes where profile_id = $1 order by actualizada_en desc limit 2000`, [APP_PROFILE_ID]);
  return rows.map((r) => r.datos_json as Vacante).find((v) => clavesDeVacante(v).has(clave));
}

async function leerAprendidas(): Promise<Record<string, string>> {
  const { rows } = await getPool().query(`select aprendidas_json from profiles where id = $1`, [APP_PROFILE_ID]);
  const crudo = rows[0]?.aprendidas_json;
  if (!crudo || typeof crudo !== "object") return {};
  return Object.fromEntries(Object.entries(crudo as Record<string, unknown>).filter((e): e is [string, string] => typeof e[1] === "string"));
}

function partirNombre(completo: string): { nombre: string; apellido: string } {
  const p = completo.trim().split(/\s+/).filter(Boolean);
  if (p.length <= 1) return { nombre: p[0] ?? "", apellido: "" };
  // Con cuatro palabras o más suele haber dos nombres («María José López Pérez»).
  const n = p.length >= 4 ? 2 : 1;
  return { nombre: p.slice(0, n).join(" "), apellido: p.slice(n).join(" ") };
}

function datosDelPerfil(p: PerfilJson, extra: Pick<DatosAutollenado, "respuestas" | "carta" | "cvTexto" | "aprendidas">, ahora: Date): DatosAutollenado {
  const b = p.basics;
  const red = (n: string) => b.profiles.find((x) => x.network.toLowerCase() === n)?.url;
  const actual = p.work.find((w) => !w.endDate);
  return {
    ...partirNombre(b.name),
    nombreCompleto: b.name,
    correo: b.email,
    telefono: b.phone,
    ciudad: b.location?.city,
    paisResidencia: b.location?.countryCode,
    linkedin: red("linkedin"),
    github: red("github"),
    twitter: red("twitter") ?? red("x"),
    portafolio: b.url,
    empresaActual: actual?.name,
    puestoActual: actual?.position,
    aniosExperiencia: aniosDeExperiencia(p, extra.respuestas, ahora),
    ...extra,
  };
}

/** Todo lo que la extensión necesita para llenar el formulario que está abierto. */
export async function datosParaFormulario(url: string, ahora = new Date()): Promise<RespuestaAutollenado> {
  const { perfil } = await loadState();
  const cv = cvActivo(perfil);
  if (!cv) throw new ErrorVacantes(409, "Primero sube tu CV en EmpleaTech.");
  const base = estructuradoDe(cv);
  const [vacante, aprendidas] = await Promise.all([vacantePorUrl(url), leerAprendidas()]);

  let doc: PerfilJson = base;
  let idioma: IdiomaDoc = detectarIdioma(prep(perfilATexto(base)).folded) === "en" ? "en" : "es";
  let carta: string | undefined;
  if (vacante) {
    const d = prepararDocumentos(base, { titulo: vacante.titulo, empresa: vacante.empresa, texto: vacante.descripcion }, perfil.respuestas, ahora);
    doc = d.cv;
    idioma = d.idioma;
    carta = d.carta;
  }

  const nombre = base.basics.name;
  const [pdfCv, pdfCarta] = await Promise.all([cvAPdf(doc, idioma), carta ? cartaAPdf(carta, nombre) : Promise.resolve(undefined)]);
  return {
    datos: datosDelPerfil(base, { respuestas: perfil.respuestas, carta, cvTexto: cvATexto(doc, idioma), aprendidas }, ahora),
    ...(vacante ? { vacante: { id: vacante.id, titulo: vacante.titulo, empresa: vacante.empresa } } : {}),
    archivos: {
      cv: { nombre: nombreArchivo("CV", nombre), tipo: "application/pdf", base64: Buffer.from(pdfCv).toString("base64") },
      ...(pdfCarta ? { carta: { nombre: nombreArchivo("Carta", nombre, vacante?.empresa ?? ""), tipo: "application/pdf" as const, base64: Buffer.from(pdfCarta).toString("base64") } } : {}),
    },
  };
}

/**
 * Tú enviaste el formulario (la extensión vio la confirmación): queda en el tracker como postulada. Ese clic en
 * «Enviar» es el sello humano. Si ya estaba registrada, no se duplica.
 */
export async function registrarEnvio(url: string, tituloPagina: string, ahora = new Date()): Promise<{ registrada: boolean; empresa: string; puesto: string }> {
  const [{ perfil, postulaciones }, vacante] = await Promise.all([loadState(), vacantePorUrl(url)]);
  const clave = claveDePostulacion(url);
  const empresa = vacante?.empresa ?? (new URL(url).hostname.replace(/^www\./, "") || "Empresa");
  const puesto = vacante?.titulo ?? (tituloPagina.trim().slice(0, 150) || "Postulación");
  const destino = vacante?.urlPostular ?? vacante?.url ?? url;
  const claveDestino = claveDePostulacion(destino);
  const yaEsta = postulaciones.some((p) => {
    if (!p.postuladaEn) return false;
    const c = claveDePostulacion(p.url);
    return c === clave || c === claveDestino;
  });
  if (yaEsta) return { registrada: false, empresa, puesto };

  const cv = cvActivo(perfil);
  const id = crypto.randomUUID();
  const oferta = vacante && cv ? analizarOferta(cv.texto, `${vacante.titulo}\n${vacante.descripcion}`, cv.id, ahora) : undefined;
  const lista = marcarPostulada(crear(postulaciones, { empresa, puesto, url: destino, oferta }, ahora, id), id, [...SELLO_ITEMS], ahora);
  await saveState({ perfil, postulaciones: lista });
  if (vacante) await getPool().query(`update vacantes set estado = 'guardada', actualizada_en = now() where profile_id = $1 and id = $2`, [APP_PROFILE_ID, vacante.id]);
  return { registrada: true, empresa, puesto };
}

/** Guarda lo que respondiste a mano para reutilizarlo en el siguiente formulario. */
export async function guardarAprendidas(items: unknown): Promise<number> {
  if (!Array.isArray(items)) return 0;
  const nuevas: Record<string, string> = {};
  for (const it of items.slice(0, 100)) {
    const o = (typeof it === "object" && it !== null ? it : {}) as Record<string, unknown>;
    if (typeof o.clave !== "string" || typeof o.valor !== "string") continue;
    const clave = o.clave.trim().slice(0, 160);
    const valor = o.valor.trim().slice(0, 2000);
    if (clave.length >= 4 && valor) nuevas[clave] = valor;
  }
  if (!Object.keys(nuevas).length) return 0;
  const todas = { ...(await leerAprendidas()), ...nuevas };
  const recortadas = Object.fromEntries(Object.entries(todas).slice(-MAX_APRENDIDAS));
  await getPool().query(`update profiles set aprendidas_json = $2::jsonb, updated_at = now() where id = $1`, [APP_PROFILE_ID, JSON.stringify(recortadas)]);
  return Object.keys(nuevas).length;
}
