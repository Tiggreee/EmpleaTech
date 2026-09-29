/**
 * Quién puede hablar con tu EmpleaTech. Corre en tu computadora y guarda tus datos personales, así que:
 *  - Solo atiende nombres locales (localhost, 127.0.0.1, ::1). Un sitio que apunte su dominio a tu IP (DNS rebinding)
 *    llega con otro Host y se rechaza, aunque el navegador crea que es «su» sitio.
 *  - Ninguna página de otro origen puede cambiar nada: las escrituras de un navegador traen Origin y debe ser el de la
 *    app (o la extensión, cuya ruta verifica aparte su encabezado propio).
 */

export interface SolicitudAcceso {
  metodo: string;
  host: string | null;
  origen: string | null;
  /** Encabezado Sec-Fetch-Site que mandan los navegadores modernos. */
  sitio: string | null;
}

export interface Rechazo {
  status: number;
  mensaje: string;
}

const LOCAL = /^(localhost|[a-z0-9-]+\.localhost|127(?:\.\d{1,3}){3}|\[::1\])(?::\d{1,5})?$/;
const LECTURA = new Set(["GET", "HEAD", "OPTIONS"]);

/** Hosts extra permitidos (EMPLEATECH_HOSTS=mi-pc.lan,otra:3000), por si algún día la sirves detrás de otro nombre. */
export function hostsExtra(valor: string | undefined): string[] {
  return (valor ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

export function hostPermitido(host: string | null, extra: string[] = []): boolean {
  if (!host) return false;
  const h = host.trim().toLowerCase();
  return LOCAL.test(h) || extra.includes(h) || extra.includes(h.replace(/:\d{1,5}$/, ""));
}

export function rechazoDeAcceso(s: SolicitudAcceso, extra: string[] = []): Rechazo | null {
  if (!hostPermitido(s.host, extra)) return { status: 403, mensaje: "EmpleaTech solo atiende en tu computadora (localhost)." };
  if (LECTURA.has(s.metodo.toUpperCase())) return null;

  const cruzado = { status: 403, mensaje: "Otra página intentó cambiar tus datos de EmpleaTech; lo bloqueamos." };
  if (s.origen) {
    if (s.origen.startsWith("chrome-extension://")) return null;
    try {
      return new URL(s.origen).host.toLowerCase() === s.host?.trim().toLowerCase() ? null : cruzado;
    } catch {
      return cruzado; // Origin «null» (iframes aislados, archivos locales) no es la app.
    }
  }
  // Sin Origin: herramientas de línea de comandos o el propio servidor. Un navegador moderno igual avisa si es cruzada.
  return s.sitio === "cross-site" || s.sitio === "same-site" ? cruzado : null;
}
