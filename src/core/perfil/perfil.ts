export const MAX_CVS = 5;
export const MAX_CARACTERES_CV = 60_000;
export const MIN_CARACTERES_CV = 30;

export interface PerfilCv {
  id: string;
  nombre: string;
  texto: string;
  actualizadoEn: string;
}

export interface EstadoPerfil {
  activoId: string | null;
  cvs: PerfilCv[];
}

export const PERFIL_VACIO: EstadoPerfil = { activoId: null, cvs: [] };

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

export function agregarCv(e: EstadoPerfil, datos: { nombre?: string; texto: string }, ahora: Date, id: string): EstadoPerfil {
  if (e.cvs.length >= MAX_CVS) throw new Error(`Puedes guardar hasta ${MAX_CVS} versiones de CV. Elimina una para agregar otra.`);
  const cv: PerfilCv = {
    id,
    nombre: validarNombre(datos.nombre, `CV ${e.cvs.length + 1}`),
    texto: validarTexto(datos.texto),
    actualizadoEn: ahora.toISOString(),
  };
  return { activoId: e.activoId ?? id, cvs: [...e.cvs, cv] };
}

export function actualizarCv(e: EstadoPerfil, id: string, cambios: { nombre?: string; texto?: string }, ahora: Date): EstadoPerfil {
  if (!e.cvs.some((c) => c.id === id)) throw new Error("CV no encontrado.");
  return {
    ...e,
    cvs: e.cvs.map((c) =>
      c.id === id
        ? {
            ...c,
            nombre: cambios.nombre === undefined ? c.nombre : validarNombre(cambios.nombre, c.nombre),
            texto: cambios.texto === undefined ? c.texto : validarTexto(cambios.texto),
            actualizadoEn: ahora.toISOString(),
          }
        : c,
    ),
  };
}

export function activarCv(e: EstadoPerfil, id: string): EstadoPerfil {
  if (!e.cvs.some((c) => c.id === id)) throw new Error("CV no encontrado.");
  return { ...e, activoId: id };
}

export function eliminarCv(e: EstadoPerfil, id: string): EstadoPerfil {
  const cvs = e.cvs.filter((c) => c.id !== id);
  const activoId = e.activoId === id ? (cvs[0]?.id ?? null) : e.activoId;
  return { activoId, cvs };
}

export function sanitizarPerfil(crudo: unknown): EstadoPerfil {
  if (typeof crudo !== "object" || crudo === null) return PERFIL_VACIO;
  const o = crudo as { activoId?: unknown; cvs?: unknown };
  const cvs: PerfilCv[] = [];
  const vistos = new Set<string>();
  for (const it of Array.isArray(o.cvs) ? o.cvs : []) {
    if (typeof it !== "object" || it === null || cvs.length >= MAX_CVS) continue;
    const c = it as Record<string, unknown>;
    if (typeof c.id !== "string" || !c.id || c.id.length > 80 || vistos.has(c.id)) continue;
    if (typeof c.texto !== "string" || c.texto.trim().length < MIN_CARACTERES_CV || c.texto.length > MAX_CARACTERES_CV) continue;
    vistos.add(c.id);
    cvs.push({
      id: c.id,
      nombre: validarNombre(typeof c.nombre === "string" ? c.nombre : undefined, `CV ${cvs.length + 1}`),
      texto: c.texto,
      actualizadoEn:
        typeof c.actualizadoEn === "string" && !Number.isNaN(new Date(c.actualizadoEn).getTime()) ? new Date(c.actualizadoEn).toISOString() : new Date(0).toISOString(),
    });
  }
  const activoId = typeof o.activoId === "string" && cvs.some((c) => c.id === o.activoId) ? o.activoId : (cvs[0]?.id ?? null);
  return { activoId, cvs };
}
