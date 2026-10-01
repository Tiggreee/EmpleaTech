"use client";

import Link from "next/link";
import { cvActivo } from "@/core/perfil/perfil";
import { useDatosApp } from "@/storage/hooks";

/**
 * En la portada, «Sube tu CV» es la explicación de cómo funciona, no una petición. Si tu CV ya está guardado, lo dice
 * arriba para que no parezca que falta, y te manda directo a lo que sigue.
 */
export default function TuCvListo() {
  const { perfil, cargando, error } = useDatosApp();
  const cv = cvActivo(perfil);
  if (cargando || error || !cv) return null;

  return (
    <div role="status" className="mt-8 flex flex-wrap items-center justify-between gap-3 border-2 border-texto bg-papel px-4 py-3">
      <p className="text-sm">
        <span aria-hidden="true" className="mr-2 inline-block h-2.5 w-2.5 bg-naranja" />
        <span className="font-mono text-xs uppercase tracking-widest text-tenue">Paso 1 listo · </span>
        Tu CV ya está cargado: <strong>{cv.nombre}</strong>. No tienes que volver a subirlo.
      </p>
      <Link href="/hoy" className="font-mono text-xs uppercase tracking-[0.08em] underline underline-offset-4">
        Sigue: tus vacantes de hoy →
      </Link>
    </div>
  );
}
