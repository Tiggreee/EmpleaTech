import { createHash, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { ok, respuestaError } from "@/server/api";
import { buscarAhora } from "@/server/vacantes";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Consultar varias plataformas en paralelo puede tardar; cada una tiene su propio tiempo límite.
export const maxDuration = 60;

/** Solo quien tenga CRON_SECRET (el programador de tareas de Vercel lo manda como «Bearer»). */
function autorizado(request: Request): boolean {
  const secreto = process.env.CRON_SECRET?.trim() ?? "";
  if (secreto.length < 16) return false;
  const h = (s: string) => createHash("sha256").update(s).digest();
  return timingSafeEqual(h(request.headers.get("authorization") ?? ""), h(`Bearer ${secreto}`));
}

/** Búsqueda diaria: al abrir la app ya tienes vacantes y proyectos nuevos, puntuados contra tu CV. */
export async function GET(request: Request) {
  if (!autorizado(request)) return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  try {
    const r = await buscarAhora();
    return ok({ nuevas: r.nuevas, fuentes: r.reporte.map((f) => ({ fuente: f.fuente, estado: f.estado, aceptadas: f.aceptadas })) });
  } catch (error) {
    return respuestaError(error);
  }
}
