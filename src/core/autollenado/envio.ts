/**
 * Puesto y empresa de una postulación que no vino de tu búsqueda, a partir del título del formulario y su dirección.
 * Los formularios de Greenhouse, Lever y Ashby llevan la empresa en el primer tramo de la ruta (/acme-pagos/…), y sus
 * títulos la combinan con el puesto de formas distintas («Empresa - Puesto», «Puesto @ Empresa», «Job Application for
 * Puesto at Empresa»).
 */
const ATS = /(^|\.)(greenhouse\.io|lever\.co|ashbyhq\.com)$/i;
const MAX = 150;

const normal = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");

const bonito = (slug: string) =>
  slug
    .split(/[-_]+/)
    .filter(Boolean)
    .map((p) => p[0].toUpperCase() + p.slice(1))
    .join(" ");

const corto = (r: { puesto: string; empresa: string }) => ({ puesto: r.puesto.slice(0, MAX), empresa: r.empresa.slice(0, MAX) });

export function puestoYEmpresa(url: string, titulo: string): { puesto: string; empresa: string } {
  const t = titulo.replace(/\s+/g, " ").trim();
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return corto({ puesto: t || "Postulación", empresa: "Empresa" });
  }
  const host = u.hostname.replace(/^www\./, "");
  const slug = ATS.test(host) ? (u.pathname.split("/").filter(Boolean)[0] ?? "") : "";

  const greenhouse = /^job application for (.+) at (.+)$/i.exec(t);
  if (greenhouse) return corto({ puesto: greenhouse[1].trim(), empresa: greenhouse[2].trim() });

  const partes = t
    .split(/\s+(?:[-–—|@]|at)\s+/i)
    .map((s) => s.trim())
    .filter(Boolean);
  if (partes.length >= 2) {
    const clave = normal(slug);
    const i = clave
      ? partes.findIndex((p) => {
          const n = normal(p);
          return n === clave || (n.length >= 3 && (clave.includes(n) || n.includes(clave)));
        })
      : -1;
    if (i >= 0) return corto({ puesto: partes.filter((_, j) => j !== i).join(" - "), empresa: partes[i] });
    // Sin pista en la dirección: «Puesto - Empresa» es lo más común.
    return corto({ puesto: partes.slice(0, -1).join(" - "), empresa: partes[partes.length - 1] });
  }
  return corto({ puesto: t || "Postulación", empresa: slug ? bonito(slug) : host || "Empresa" });
}
