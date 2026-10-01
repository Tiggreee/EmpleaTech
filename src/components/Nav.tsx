"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { APP_NAME } from "@/config/app";
import { borrarEstadoLocal } from "@/storage/almacenes";
import { cx } from "@/ui/ui";

interface Pestana {
  href: string;
  texto: string;
  /** Solo cuando la app vive en internet con contraseña. */
  conSesion?: boolean;
}

interface Seccion {
  href: string;
  texto: string;
  /** Las páginas de la sección; si son varias, salen como pestañas en una segunda línea. */
  pestanas: Pestana[];
  /** Páginas que pertenecen a la sección sin ser pestaña (p. ej. preparar CV y carta). */
  otras?: string[];
}

/** Seis secciones en lugar de once enlaces: lo demás vive como pestaña dentro de su sección. */
const SECCIONES: Seccion[] = [
  {
    href: "/panel",
    texto: "Panel",
    pestanas: [
      { href: "/panel", texto: "Panel" },
      { href: "/inteligencia", texto: "Inteligencia" },
    ],
  },
  { href: "/hoy", texto: "Hoy", pestanas: [] },
  {
    href: "/vacantes",
    texto: "Vacantes",
    pestanas: [
      { href: "/vacantes", texto: "Empleos" },
      { href: "/analizar", texto: "Analizar una oferta" },
    ],
    otras: ["/preparar"],
  },
  { href: "/freelance", texto: "Freelance", pestanas: [] },
  {
    href: "/postulaciones",
    texto: "Postulaciones",
    pestanas: [
      { href: "/postulaciones", texto: "Seguimiento" },
      { href: "/resultados", texto: "Resultados" },
    ],
  },
  {
    href: "/cv",
    texto: "Mi CV",
    pestanas: [
      { href: "/cv", texto: "Mi CV" },
      { href: "/perfil", texto: "Perfil y respuestas" },
      { href: "/autollenado", texto: "Autollenado" },
      { href: "/seguridad", texto: "Seguridad", conSesion: true },
    ],
  },
];

const deLaSeccion = (s: Seccion, ruta: string) => ruta === s.href || s.pestanas.some((p) => p.href === ruta) || !!s.otras?.includes(ruta);

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
 * En pantallas chicas las secciones van detrás de «Menú»; las pestañas de la sección actual siempre se ven.
 */
export default function Nav({ conSesion = false }: { conSesion?: boolean }) {
  const ruta = usePathname();
  const [abierto, setAbierto] = useState(false);
  if (ruta === "/entrar") return null;
  const actual = SECCIONES.find((s) => deLaSeccion(s, ruta));
  const pestanas = (actual?.pestanas ?? []).filter((p) => conSesion || !p.conSesion);

  const secciones = (movil: boolean) => (
    <>
      {SECCIONES.map((s) => {
        const activa = s === actual;
        return (
          <li key={s.href}>
            <Link
              href={s.href}
              aria-current={ruta === s.href ? "page" : activa ? "true" : undefined}
              onClick={() => setAbierto(false)}
              className={cx(
                "font-mono uppercase tracking-[0.08em] transition-colors",
                movil ? "flex min-h-12 items-center border-b border-linea px-1 text-sm" : "border-b-2 py-1 text-xs",
                activa ? (movil ? "text-texto" : "border-naranja text-texto") : cx("text-tenue hover:text-texto", !movil && "border-transparent"),
              )}
            >
              {movil && activa && <span aria-hidden="true" className="mr-2 inline-block h-2.5 w-2.5 bg-naranja" />}
              {s.texto}
            </Link>
          </li>
        );
      })}
      {conSesion && (
        <li className={movil ? "" : "ml-1 border-l-2 border-linea pl-3 lg:ml-2 lg:pl-5"}>
          <button
            type="button"
            onClick={() => void salir()}
            className={cx("font-mono uppercase tracking-[0.08em] text-tenue transition-colors hover:text-texto", movil ? "flex min-h-12 w-full items-center px-1 text-sm" : "py-1 text-xs")}
          >
            Salir
          </button>
        </li>
      )}
    </>
  );

  return (
    <header className="sticky top-0 z-20 border-b-[3px] border-texto bg-fondo/95 backdrop-blur">
      <nav
        className="mx-auto max-w-6xl px-5 py-3"
        aria-label="Principal"
        onKeyDown={(e) => {
          if (e.key === "Escape" && abierto) setAbierto(false);
        }}
      >
        <div className="flex items-center justify-between gap-4">
          <Link href="/" className="flex shrink-0 items-center gap-2 text-lg font-black uppercase tracking-[-0.04em] lg:text-xl" onClick={() => setAbierto(false)}>
            <Logo />
            <span>{APP_NAME}</span>
          </Link>
          <ul className="hidden items-center gap-x-4 md:flex lg:gap-x-6">{secciones(false)}</ul>
          <button
            type="button"
            className="boton boton-sec md:hidden"
            aria-expanded={abierto}
            aria-controls="menu-principal"
            onClick={() => setAbierto(!abierto)}
          >
            {abierto ? "Cerrar" : "Menú"}
          </button>
        </div>
        {abierto && (
          <ul id="menu-principal" className="mt-3 border-t-[3px] border-texto pt-1 md:hidden">
            {secciones(true)}
          </ul>
        )}
      </nav>

      {pestanas.length > 1 && (
        <nav aria-label={`Secciones de ${actual?.texto}`} className="border-t border-linea">
          <ul className="mx-auto flex max-w-6xl gap-1 overflow-x-auto px-5 py-2">
            {pestanas.map((p) => {
              const activa = ruta === p.href;
              return (
                <li key={p.href} className="shrink-0">
                  <Link
                    href={p.href}
                    aria-current={activa ? "page" : undefined}
                    className={cx(
                      "inline-flex min-h-10 items-center px-3 font-mono text-xs uppercase tracking-[0.08em] transition-colors",
                      activa ? "bg-texto text-fondo" : "text-tenue hover:bg-superficie hover:text-texto",
                    )}
                  >
                    {p.texto}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      )}
    </header>
  );
}
