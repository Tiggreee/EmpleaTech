"use client";

import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import { useDatosApp } from "@/storage/hooks";
import { Aviso, Boton, EnlaceBoton } from "@/ui/ui";

/** Pantallas que muestran tu perfil o tus postulaciones. Las demás no esperan a tus datos. */
const CON_DATOS = ["/panel", "/hoy", "/vacantes", "/freelance", "/analizar", "/cv", "/perfil", "/postulaciones", "/preparar"];

const conDatos = (ruta: string) => CON_DATOS.some((r) => ruta === r || ruta.startsWith(`${r}/`));
const sinInternet = () => typeof navigator !== "undefined" && navigator.onLine === false;

function Esqueleto() {
  return (
    <main className="mx-auto max-w-4xl px-5 py-10" aria-busy="true">
      <p role="status" className="sr-only">
        Cargando tus datos…
      </p>
      <div className="mb-8 space-y-3" aria-hidden="true">
        <div className="h-8 w-56 max-w-full animate-pulse rounded-lg bg-superficie" />
        <div className="h-4 w-96 max-w-full animate-pulse rounded bg-superficie/70" />
      </div>
      <div className="space-y-4" aria-hidden="true">
        {[0, 1, 2].map((i) => (
          <div key={i} className="vidrio h-28 animate-pulse" />
        ))}
      </div>
    </main>
  );
}

/**
 * Mientras llegan tus datos no se muestra nada que pueda mentir («aún no tienes CV», «sube tu CV primero»); si no
 * llegan, se dice que fallaron en vez de mostrar la pantalla vacía. Sin internet se usa la copia de este navegador.
 */
export default function PuertaDatos({ children }: { children: ReactNode }) {
  const ruta = usePathname();
  const { cargando, error, copiaLocal, sesionVencida, recargar } = useDatosApp();
  const [reintentando, setReintentando] = useState(false);

  if (!conDatos(ruta)) return children;

  if (error && sesionVencida) {
    return (
      <main className="mx-auto max-w-xl px-5 py-16">
        <Aviso tono="aviso" titulo="Tu sesión terminó">
          <p>Vuelve a entrar para ver tus datos. No se perdió nada.</p>
          <EnlaceBoton className="mt-3" href={`/entrar?volver=${encodeURIComponent(ruta)}`}>
            Entrar de nuevo
          </EnlaceBoton>
        </Aviso>
      </main>
    );
  }

  const reintentar = () => {
    setReintentando(true);
    recargar()
      .catch(() => undefined)
      .finally(() => setReintentando(false));
  };

  // Sin internet la barra de arriba ya lo avisa y la pantalla trabaja con lo que haya en este navegador.
  if (error && !sinInternet()) {
    const boton = (
      <Boton className="mt-3" onClick={reintentar} disabled={reintentando}>
        {reintentando ? "Reintentando…" : "Reintentar"}
      </Boton>
    );
    if (copiaLocal) {
      return (
        <>
          <div className="mx-auto max-w-6xl px-5 pt-6">
            <Aviso tono="aviso" titulo="No pudimos hablar con el servidor">
              <p>Estás viendo la copia guardada en este navegador; lo que cambies no se guardará hasta que vuelva la conexión.</p>
              {boton}
            </Aviso>
          </div>
          {children}
        </>
      );
    }
    return (
      <main className="mx-auto max-w-xl px-5 py-16">
        <Aviso tono="riesgo" titulo="No pudimos cargar tus datos">
          <p>{error}</p>
          {boton}
        </Aviso>
      </main>
    );
  }

  if (cargando && !copiaLocal) return <Esqueleto />;
  return children;
}
