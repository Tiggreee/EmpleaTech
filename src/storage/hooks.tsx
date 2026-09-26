"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { PERFIL_VACIO, sanitizarPerfil, type EstadoPerfil } from "@/core/perfil/perfil";
import { sanitizar, type Postulacion } from "@/core/seguimiento/seguimiento";
import { borrarEstadoLocal, guardarEstadoLocal, leerEstadoLocal } from "./almacenes";

interface EstadoApp {
  perfil: EstadoPerfil;
  postulaciones: Postulacion[];
}

interface ContextoDatos extends EstadoApp {
  cargando: boolean;
  error: string | null;
  guardarEstado: (siguiente: Partial<EstadoApp>) => Promise<EstadoApp>;
  recargar: () => Promise<EstadoApp>;
  borrarDatos: () => Promise<void>;
}

const DatosContexto = createContext<ContextoDatos | null>(null);

function normalizar(payload: Partial<EstadoApp> | null | undefined): EstadoApp {
  return {
    perfil: sanitizarPerfil(payload?.perfil ?? PERFIL_VACIO),
    postulaciones: sanitizar(payload?.postulaciones ?? []).items,
  };
}

async function leerServidor(): Promise<EstadoApp> {
  const res = await fetch("/api/state", { cache: "no-store" });
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new Error(body?.error ?? "No se pudo leer el estado del servidor.");
  }
  return normalizar((await res.json()) as EstadoApp);
}

async function escribirServidor(payload: EstadoApp): Promise<EstadoApp> {
  const res = await fetch("/api/state", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new Error(body?.error ?? "No se pudo guardar el estado en el servidor.");
  }
  return normalizar((await res.json()) as EstadoApp);
}

function estaVacio(estado: EstadoApp): boolean {
  return estado.perfil.cvs.length === 0 && estado.postulaciones.length === 0;
}

export function DatosProvider({ children }: { children: ReactNode }) {
  const [semillaLocal] = useState(() => normalizar(leerEstadoLocal()));
  const [perfil, setPerfil] = useState(semillaLocal.perfil);
  const [postulaciones, setPostulaciones] = useState<Postulacion[]>(semillaLocal.postulaciones);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const aplicarEstado = useCallback((estado: EstadoApp) => {
    setPerfil(estado.perfil);
    setPostulaciones(estado.postulaciones);
    guardarEstadoLocal(estado);
    return estado;
  }, []);

  const recargar = useCallback(async () => {
    const remoto = await leerServidor();
    return aplicarEstado(remoto);
  }, [aplicarEstado]);

  const guardarEstado = useCallback(async (siguiente: Partial<EstadoApp>) => {
    const payload = normalizar({
      perfil: siguiente.perfil ?? perfil,
      postulaciones: siguiente.postulaciones ?? postulaciones,
    });
    const guardado = await escribirServidor(payload);
    setError(null);
    return aplicarEstado(guardado);
  }, [aplicarEstado, perfil, postulaciones]);

  const borrarDatos = useCallback(async () => {
    const res = await fetch("/api/state", { method: "DELETE" });
    if (!res.ok) {
      const body = (await res.json().catch(() => null)) as { error?: string } | null;
      throw new Error(body?.error ?? "No se pudieron borrar los datos guardados.");
    }
    borrarEstadoLocal();
    setPerfil(PERFIL_VACIO);
    setPostulaciones([]);
    setError(null);
  }, []);

  useEffect(() => {
    let activo = true;

    void (async () => {
      try {
        const remoto = await leerServidor();
        if (!activo) return;
        if (estaVacio(remoto) && !estaVacio(semillaLocal)) {
          const migrado = await escribirServidor(semillaLocal);
          if (!activo) return;
          aplicarEstado(migrado);
        } else {
          aplicarEstado(remoto);
        }
        setError(null);
      } catch (err) {
        if (!activo) return;
        setError(err instanceof Error ? err.message : "No se pudo sincronizar con la base local.");
      } finally {
        if (activo) setCargando(false);
      }
    })();

    return () => {
      activo = false;
    };
  }, [aplicarEstado, semillaLocal]);

  const valor = useMemo<ContextoDatos>(() => ({
    perfil,
    postulaciones,
    cargando,
    error,
    guardarEstado,
    recargar,
    borrarDatos,
  }), [perfil, postulaciones, cargando, error, guardarEstado, recargar, borrarDatos]);

  return <DatosContexto.Provider value={valor}>{children}</DatosContexto.Provider>;
}

export function useDatosApp(): ContextoDatos {
  const valor = useContext(DatosContexto);
  if (!valor) throw new Error("useDatosApp debe usarse dentro de DatosProvider.");
  return valor;
}

export const usePerfil = () => useDatosApp().perfil;
export const usePostulaciones = () => useDatosApp().postulaciones;
