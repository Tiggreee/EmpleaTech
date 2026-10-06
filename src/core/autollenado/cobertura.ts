/**
 * Dónde trabaja la extensión: llena el formulario de postulación o pone la propuesta del proyecto. Debe coincidir con
 * los `content_scripts` de extension/manifest.json (lo revisa cobertura.test.ts).
 */
export const SITIOS_FORMULARIO = ["boards.greenhouse.io", "job-boards.greenhouse.io", "jobs.lever.co", "jobs.ashbyhq.com", "app.usebraintrust.com"] as const;
export const SITIOS_PROPUESTA = ["www.workana.com", "www.upwork.com", "www.freelancer.com"] as const;

export type Cobertura = "formulario" | "propuesta";

/** Qué hace la extensión en esa dirección; null si ahí no hace nada y se llena a mano. */
export function coberturaDe(url: string | undefined): Cobertura | null {
  let host: string;
  try {
    host = new URL(url ?? "").hostname.toLowerCase();
  } catch {
    return null;
  }
  if ((SITIOS_FORMULARIO as readonly string[]).includes(host)) return "formulario";
  if ((SITIOS_PROPUESTA as readonly string[]).includes(host)) return "propuesta";
  return null;
}
