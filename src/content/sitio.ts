/**
 * URL pública del sitio (sin barra final): NEXT_PUBLIC_SITE_URL si la defines; en Vercel, su dominio de producción;
 * en tu computadora, localhost.
 */
export const SITIO = (
  process.env.NEXT_PUBLIC_SITE_URL ?? (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "http://localhost:3000")
).replace(/\/+$/, "");
