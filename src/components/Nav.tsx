"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { APP_NAME } from "@/config/app";
import { borrarEstadoLocal } from "@/storage/almacenes";
import { cx } from "@/ui/ui";

const ENLACES = [
  { href: "/panel", texto: "Panel" },
  { href: "/hoy", texto: "Hoy" },
  { href: "/vacantes", texto: "Vacantes" },
  { href: "/freelance", texto: "Freelance" },
  { href: "/analizar", texto: "Analizar" },
  { href: "/cv", texto: "Mi CV" },
  { href: "/perfil", texto: "Perfil" },
  { href: "/postulaciones", texto: "Postulaciones" },
  { href: "/resultados", texto: "Resultados" },
  { href: "/inteligencia", texto: "Inteligencia" },
];

export function Logo({ tamano = 24 }: { tamano?: number }) {
  return (
    <svg width={tamano} height={tamano} viewBox="0 0 32 32" aria-hidden="true">
      <path d="M16 2 L29 28 H3 Z" fill="none" stroke="var(--texto)" strokeWidth="3" strokeLinejoin="miter" />
      <circle cx="16" cy="3.5" r="2.8" fill="var(--naranja)" />
    </svg>
  );
}

async function salir() {
  await fetch("/api/acceso", { method: "DELETE" }).catch(() => undefined);
  // La copia de tu perfil y tu CV que guarda este navegador también se va: en una computadora prestada no queda nada.
  borrarEstadoLocal();
  // Recarga completa a propósito (no router.push): que tus datos en memoria no se queden en la pestaña.
  // eslint-disable-next-line @next/next/no-location-assign-relative-destination
  window.location.href = "/entrar";
}

/**
 * `conSesion`: la app vive en internet y pide contraseña; entonces aparecen «Seguridad» y «Salir».
 * En pantallas chicas los enlaces van detrás de «Menú»: doce enlaces pegados arriba se comían media pantalla.
 */
export default function Nav({ conSesion = false }: { conSesion?: boolean }) {
  const ruta = usePathname();
  const [abierto, setAbierto] = useState(false);
  if (ruta === "/entrar") return null;
  const enlaces = conSesion ? [...ENLACES, { href: "/seguridad", texto: "Seguridad" }] : ENLACES;

  const elementos = (movil: boolean) => (
    <>
      {enlaces.map((e) => {
        const activo = ruta === e.href;
        return (
          <li key={e.href}>
            <Link
              href={e.href}
              aria-current={activo ? "page" : undefined}
              onClick={() => setAbierto(false)}
              className={cx(
                "font-mono text-xs uppercase tracking-wider transition-colors",
                movil ? "flex min-h-11 items-center border-b border-linea px-1 text-sm" : "border-b-2 px-0.5 py-1",
                activo ? (movil ? "font-semibold text-texto" : "border-naranja text-texto") : cx("text-tenue hover:text-texto", !movil && "border-transparent"),
              )}
            >
              {e.texto}
            </Link>
          </li>
        );
      })}
      {conSesion && (
        <li>
          <button
            type="button"
            onClick={() => void salir()}
            className={cx("font-mono text-xs uppercase tracking-wider text-tenue transition-colors hover:text-texto", movil ? "flex min-h-11 w-full items-center px-1 text-sm" : "py-1")}
          >
            Salir
          </button>
        </li>
      )}
    </>
  );

  return (
    <header className="sticky top-0 z-20 border-b-2 border-texto bg-fondo/95 backdrop-blur">
      <nav
        className="mx-auto max-w-6xl px-5 py-3"
        aria-label="Principal"
        onKeyDown={(e) => {
          if (e.key === "Escape" && abierto) setAbierto(false);
        }}
      >
        <div className="flex items-center justify-between gap-4">
          <Link href="/" className="flex items-center gap-2 text-xl font-black uppercase tracking-[-0.04em]" onClick={() => setAbierto(false)}>
            <Logo />
            <span>{APP_NAME}</span>
          </Link>
          <ul className="hidden flex-wrap items-center justify-end gap-x-5 gap-y-1 lg:flex">{elementos(false)}</ul>
          <button
            type="button"
            className="boton boton-sec lg:hidden"
            aria-expanded={abierto}
            aria-controls="menu-principal"
            onClick={() => setAbierto(!abierto)}
          >
            {abierto ? "Cerrar" : "Menú"}
          </button>
        </div>
        {abierto && (
          <ul id="menu-principal" className="mt-3 grid gap-x-6 border-t-2 border-texto pt-2 sm:grid-cols-2 lg:hidden">
            {elementos(true)}
          </ul>
        )}
      </nav>
    </header>
  );
}

