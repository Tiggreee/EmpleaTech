import { createCipheriv, createDecipheriv, createHash, createHmac, hkdfSync, randomBytes, timingSafeEqual } from "node:crypto";

/**
 * Verificación en dos pasos con una app de autenticación (Google Authenticator, Microsoft Authenticator, 1Password,
 * Authy…). Es TOTP de RFC 6238 con lo que todas entienden: HMAC-SHA1, 6 dígitos, un código cada 30 segundos.
 */

export const PERIODO_S = 30;
export const DIGITOS = 6;
/** Acepta también el código anterior y el siguiente: el reloj del teléfono rara vez está exacto. */
const VENTANA = 1;

const ALFABETO = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

export function aBase32(bytes: Uint8Array): string {
  let bits = 0;
  let valor = 0;
  let salida = "";
  for (const b of bytes) {
    valor = ((valor << 8) | b) & 0xffff;
    bits += 8;
    while (bits >= 5) {
      salida += ALFABETO[(valor >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) salida += ALFABETO[(valor << (5 - bits)) & 31];
  return salida;
}

/** Ignora espacios, guiones, mayúsculas y el relleno «=». */
export function deBase32(texto: string): Buffer {
  const limpio = texto.toUpperCase().replace(/[\s=-]/g, "");
  let bits = 0;
  let valor = 0;
  const bytes: number[] = [];
  for (const ch of limpio) {
    const i = ALFABETO.indexOf(ch);
    if (i < 0) throw new Error("Base32 inválido.");
    valor = ((valor << 5) | i) & 0xffff;
    bits += 5;
    if (bits >= 8) {
      bytes.push((valor >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(bytes);
}

/** 160 bits: lo que recomienda el RFC para HMAC-SHA1. */
export const nuevoSecretoTotp = () => randomBytes(20);

export const pasoDe = (ahoraMs: number) => Math.floor(ahoraMs / 1000 / PERIODO_S);

export function codigoTotp(secreto: Buffer, paso: number, digitos = DIGITOS): string {
  const contador = Buffer.alloc(8);
  contador.writeBigUInt64BE(BigInt(paso));
  const h = createHmac("sha1", secreto).update(contador).digest();
  const o = h[h.length - 1] & 0xf;
  const n = ((h[o] & 0x7f) << 24) | (h[o + 1] << 16) | (h[o + 2] << 8) | h[o + 3];
  return String(n % 10 ** digitos).padStart(digitos, "0");
}

/**
 * El paso del código si es válido; null si no. Un código de un paso igual o anterior a `ultimoPaso` ya se usó (o es
 * más viejo que uno usado) y no vuelve a servir: quien lo vea por encima de tu hombro llega tarde.
 */
export function verificarTotp(secreto: Buffer, codigo: string, ahoraMs: number, ultimoPaso: number | null): number | null {
  const limpio = codigo.replace(/\s+/g, "");
  if (!new RegExp(`^\\d{${DIGITOS}}$`).test(limpio)) return null;
  const actual = pasoDe(ahoraMs);
  let valido: number | null = null;
  // Revisa toda la ventana siempre, para tardar lo mismo acierte o no.
  for (let d = -VENTANA; d <= VENTANA; d++) {
    const paso = actual + d;
    const coincide = timingSafeEqual(Buffer.from(codigoTotp(secreto, paso)), Buffer.from(limpio));
    if (coincide && valido === null && (ultimoPaso === null || paso > ultimoPaso)) valido = paso;
  }
  return valido;
}

/** Lo que lee la app al escanear el QR. */
export function uriTotp(secreto: Buffer, cuenta: string, emisor = "EmpleaTech"): string {
  const parametros = new URLSearchParams({ secret: aBase32(secreto), issuer: emisor, algorithm: "SHA1", digits: String(DIGITOS), period: String(PERIODO_S) });
  return `otpauth://totp/${encodeURIComponent(emisor)}:${encodeURIComponent(cuenta)}?${parametros}`;
}

/** El secreto en grupos de 4 para teclearlo a mano si la cámara no coopera. */
export const secretoLegible = (secreto: Buffer) => aBase32(secreto).match(/.{1,4}/g)?.join(" ") ?? "";

// ---------------------------------------------------------------------------------------------------------------
// Códigos de respaldo: para entrar si pierdes el teléfono. Cada uno sirve una vez.

const normalizarRespaldo = (c: string) => c.toLowerCase().replace(/[^a-z2-7]/g, "");

/** «abcde-fghij»: 50 bits al azar, sin 0/O ni 1/l que se confundan. */
export function nuevosCodigosRespaldo(cuantos = 8): string[] {
  return Array.from({ length: cuantos }, () => {
    const c = aBase32(randomBytes(7)).slice(0, 10).toLowerCase();
    return `${c.slice(0, 5)}-${c.slice(5)}`;
  });
}

export const huellaRespaldo = (codigo: string) => createHash("sha256").update(normalizarRespaldo(codigo)).digest("hex");

export const pareceRespaldo = (codigo: string) => normalizarRespaldo(codigo).length === 10;

// ---------------------------------------------------------------------------------------------------------------
// El secreto TOTP se guarda cifrado: una copia robada de la base no basta para generar tus códigos.

function llave(secreto: string): Buffer {
  return Buffer.from(hkdfSync("sha256", secreto, "empleatech", "totp-v1", 32));
}

export function cifrar(datos: Buffer, secreto: string): string {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", llave(secreto), iv);
  const cifrado = Buffer.concat([c.update(datos), c.final()]);
  return ["v1", iv.toString("base64url"), c.getAuthTag().toString("base64url"), cifrado.toString("base64url")].join(".");
}

/** null si no se puede (otro EMPLEATECH_SECRETO o datos alterados). */
export function descifrar(texto: string, secreto: string): Buffer | null {
  const [v, iv, tag, datos] = texto.split(".");
  if (v !== "v1" || !iv || !tag || datos === undefined) return null;
  try {
    const d = createDecipheriv("aes-256-gcm", llave(secreto), Buffer.from(iv, "base64url"));
    d.setAuthTag(Buffer.from(tag, "base64url"));
    return Buffer.concat([d.update(Buffer.from(datos, "base64url")), d.final()]);
  } catch {
    return null;
  }
}
