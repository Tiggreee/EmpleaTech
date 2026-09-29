import type { Vacante } from "../vacantes/vacante";

/**
 * Identifica una postulación por su URL, sin importar la variante: la página de la vacante, la de «aplicar» o el
 * formulario de Greenhouse incrustado en la web de la empresa (…?gh_jid=123 o /embed/job_app?token=123).
 */
export function claveDePostulacion(url: string | undefined): string | undefined {
  if (!url) return undefined;
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return undefined;
  }
  const host = u.hostname.toLowerCase();
  const ruta = u.pathname.replace(/\/+$/, "");
  const gh = u.searchParams.get("gh_jid") ?? (host.endsWith("greenhouse.io") ? (u.searchParams.get("token") ?? /\/jobs\/(\d+)/.exec(ruta)?.[1]) : undefined);
  if (gh && /^\d+$/.test(gh)) return `greenhouse:${gh}`;
  const uuid = /\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})(?:\/|$)/i.exec(ruta)?.[1]?.toLowerCase();
  if (uuid && host.endsWith("lever.co")) return `lever:${uuid}`;
  if (uuid && host.endsWith("ashbyhq.com")) return `ashby:${uuid}`;
  return `url:${host}${ruta.replace(/\/(apply|application|aplicar)$/i, "")}`;
}

/** Todas las claves con las que se puede reconocer una vacante guardada. */
export function clavesDeVacante(v: Pick<Vacante, "fuente" | "idExterno" | "url" | "urlPostular">): Set<string> {
  const claves = new Set<string>();
  for (const u of [v.url, v.urlPostular]) {
    const c = claveDePostulacion(u);
    if (c) claves.add(c);
  }
  const id = v.idExterno.split("/").pop()?.toLowerCase();
  if (id && (v.fuente === "greenhouse" || v.fuente === "lever" || v.fuente === "ashby")) claves.add(`${v.fuente}:${id}`);
  return claves;
}
