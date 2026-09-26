/** URL pública del sitio; se define al desplegar con NEXT_PUBLIC_SITE_URL (sin barra final). */
export const SITIO = (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/+$/, "");
