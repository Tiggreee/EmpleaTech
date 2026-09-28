import { leerPerfil, sanitizarPerfilJson, type PerfilJson } from "./estructurado";
import { RESPUESTAS_VACIAS, sanitizarRespuestas, type Respuestas } from "./respuestas";

export const MAX_CVS = 5;
export const MAX_CARACTERES_CV = 60_000;
export const MIN_CARACTERES_CV = 30;

export interface PerfilCv {
  id: string;
  nombre: string;
  texto: string;
  actualizadoEn: string;
  /** Lo que la app entendió del CV (JSON Resume), con las correcciones del usuario. */
  estructurado?: PerfilJson;
  /** true cuando el usuario corrigió el perfil a mano: editar el texto ya no lo sobrescribe. */
  estructuradoEditado?: boolean;
}

export interface EstadoPerfil {
  activoId: string | null;
  cvs: PerfilCv[];
  respuestas: Respuestas;
}

export const PERFIL_VACIO: EstadoPerfil = { activoId: null, cvs: [], respuestas: RESPUESTAS_VACIAS };

function validarTexto(texto: string): string {
  const t = texto.replace(/\r\n/g, "\n").trim();
  if (t.length < MIN_CARACTERES_CV) throw new Error("El CV es demasiado corto para analizarlo.");
  if (t.length > MAX_CARACTERES_CV) throw new Error(`El CV supera el límite de ${MAX_CARACTERES_CV.toLocaleString("es-MX")} caracteres.`);
  return t;
}

function validarNombre(nombre: string | undefined, porDefecto: string): string {
  return (nombre ?? "").trim().slice(0, 80) || porDefecto;
}

export function cvActivo(e: EstadoPerfil): PerfilCv | undefined {
  return e.cvs.find((c) => c.id === e.activoId);
}

/** Perfil estructurado del CV; los CV guardados antes de que existiera se leen al vuelo. */
export function estructuradoDe(cv: PerfilCv): PerfilJson {
  return cv.estructurado ?? leerPerfil(cv.texto).perfil;
}

export function agregarCv(e: EstadoPerfil, datos: { nombre?: string; texto: string }, ahora: Date, id: string): EstadoPerfil {
  if (e.cvs.length >= MAX_CVS) throw new Error(`Puedes guardar hasta ${MAX_CVS} versiones de CV. Elimina una para agregar otra.`);
  const texto = validarTexto(datos.texto);
  const cv: PerfilCv = {
    id,
    nombre: validarNombre(datos.nombre, `CV ${e.cvs.length + 1}`),
    texto,
    actualizadoEn: ahora.toISOString(),
    estructurado: leerPerfil(texto).perfil,
  };
  return { ...e, activoId: e.activoId ?? id, cvs: [...e.cvs, cv] };
}

function cambiarCv(e: EstadoPerfil, id: string, fn: (c: PerfilCv) => PerfilCv): EstadoPerfil {
  if (!e.cvs.some((c) => c.id === id)) throw new Error("CV no encontrado.");
  return { ...e, cvs: e.cvs.map((c) => (c.id === id ? fn(c) : c)) };
}

export function actualizarCv(e: EstadoPerfil, id: string, cambios: { nombre?: string; texto?: string }, ahora: Date): EstadoPerfil {
  return cambiarCv(e, id, (c) => {
    const texto = cambios.texto === undefined ? c.texto : validarTexto(cambios.texto);
    const releer = texto !== c.texto && !c.estructuradoEditado;
    return {
      ...c,
      nombre: cambios.nombre === undefined ? c.nombre : validarNombre(cambios.nombre, c.nombre),
      texto,
      actualizadoEn: ahora.toISOString(),
      ...(releer ? { estructurado: leerPerfil(texto).perfil } : {}),
    };
  });
}

/** Guarda las correcciones del usuario al perfil estructurado. */
export function editarEstructurado(e: EstadoPerfil, id: string, perfil: PerfilJson, ahora: Date): EstadoPerfil {
  return cambiarCv(e, id, (c) => ({ ...c, estructurado: sanitizarPerfilJson(perfil), estructuradoEditado: true, actualizadoEn: ahora.toISOString() }));
}

/** Descarta las correcciones y vuelve a leer el perfil desde el texto del CV. */
export function releerEstructurado(e: EstadoPerfil, id: string, ahora: Date): EstadoPerfil {
  return cambiarCv(e, id, (c) => ({ ...c, estructurado: leerPerfil(c.texto).perfil, estructuradoEditado: false, actualizadoEn: ahora.toISOString() }));
}

export function guardarRespuestas(e: EstadoPerfil, respuestas: Respuestas): EstadoPerfil {
  return { ...e, respuestas: sanitizarRespuestas(respuestas) };
}

export function activarCv(e: EstadoPerfil, id: string): EstadoPerfil {
  if (!e.cvs.some((c) => c.id === id)) throw new Error("CV no encontrado.");
  return { ...e, activoId: id };
}

export function eliminarCv(e: EstadoPerfil, id: string): EstadoPerfil {
  const cvs = e.cvs.filter((c) => c.id !== id);
  const activoId = e.activoId === id ? (cvs[0]?.id ?? null) : e.activoId;
  return { ...e, activoId, cvs };
}

export function sanitizarPerfil(crudo: unknown): EstadoPerfil {
  if (typeof crudo !== "object" || crudo === null) return PERFIL_VACIO;
  const o = crudo as { activoId?: unknown; cvs?: unknown; respuestas?: unknown };
  const cvs: PerfilCv[] = [];
  const vistos = new Set<string>();
  for (const it of Array.isArray(o.cvs) ? o.cvs : []) {
    if (typeof it !== "object" || it === null || cvs.length >= MAX_CVS) continue;
    const c = it as Record<string, unknown>;
    if (typeof c.id !== "string" || !c.id || c.id.length > 80 || vistos.has(c.id)) continue;
    if (typeof c.texto !== "string" || c.texto.trim().length < MIN_CARACTERES_CV || c.texto.length > MAX_CARACTERES_CV) continue;
    vistos.add(c.id);
    const tieneEstructurado = typeof c.estructurado === "object" && c.estructurado !== null;
    cvs.push({
      id: c.id,
      nombre: validarNombre(typeof c.nombre === "string" ? c.nombre : undefined, `CV ${cvs.length + 1}`),
      texto: c.texto,
      actualizadoEn:
        typeof c.actualizadoEn === "string" && !Number.isNaN(new Date(c.actualizadoEn).getTime()) ? new Date(c.actualizadoEn).toISOString() : new Date(0).toISOString(),
      ...(tieneEstructurado ? { estructurado: sanitizarPerfilJson(c.estructurado) } : {}),
      ...(tieneEstructurado && c.estructuradoEditado === true ? { estructuradoEditado: true } : {}),
    });
  }
  const activoId = typeof o.activoId === "string" && cvs.some((c) => c.id === o.activoId) ? o.activoId : (cvs[0]?.id ?? null);
  return { activoId, cvs, respuestas: sanitizarRespuestas(o.respuestas) };
}
