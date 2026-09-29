"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { APP_NAME } from "@/config/app";

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
      <defs>
        <linearGradient id="logo-g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#22d3ee" />
          <stop offset="1" stopColor="#8b5cf6" />
        </linearGradient>
      </defs>
      <path d="M16 2 L29 28 H3 Z" fill="none" stroke="url(#logo-g)" strokeWidth="2.5" strokeLinejoin="round" />
      <circle cx="16" cy="3.5" r="2.6" fill="url(#logo-g)" />
    </svg>
  );
}

async function salir() {
  await fetch("/api/acceso", { method: "DELETE" }).catch(() => undefined);
  // Recarga completa a propósito (no router.push): que tus datos en memoria no se queden en la pestaña.
  // eslint-disable-next-line @next/next/no-location-assign-relative-destination
  window.location.href = "/entrar";
}

/** `conSesion`: la app vive en internet y pide contraseña; entonces aparece «Salir». */
export default function Nav({ conSesion = false }: { conSesion?: boolean }) {
  const ruta = usePathname();
  if (ruta === "/entrar") return null;
  return (
    <header className="sticky top-0 z-20 border-b border-white/10 bg-[#05070f]/70 backdrop-blur">
      <nav className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-4 gap-y-1 px-5 py-3" aria-label="Principal">
        <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight">
          <Logo />
          <span>{APP_NAME}</span>
        </Link>
        <ul className="flex flex-wrap items-center gap-0.5 text-sm">
          {ENLACES.map((e) => {
            const activo = ruta === e.href;
            return (
              <li key={e.href}>
                <Link
                  href={e.href}
                  aria-current={activo ? "page" : undefined}
                  className={`rounded-lg px-2.5 py-1.5 transition-colors ${activo ? "bg-white/10 text-white" : "text-tenue hover:text-white"}`}
                >
                  {e.texto}
                </Link>
              </li>
            );
          })}
          {conSesion && (
            <li>
              <button type="button" onClick={() => void salir()} className="rounded-lg px-2.5 py-1.5 text-tenue transition-colors hover:text-white">
                Salir
              </button>
            </li>
          )}
        </ul>
      </nav>
    </header>
  );
}

