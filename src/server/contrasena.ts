import { randomBytes, scrypt as scryptCb, timingSafeEqual, type ScryptOptions } from "node:crypto";
import { getPool } from "./db";

const scrypt = (clave: string, sal: Buffer, largo: number, opciones: ScryptOptions) =>
  new Promise<Buffer>((resolve, reject) => scryptCb(clave, sal, largo, opciones, (e, k) => (e ? reject(e) : resolve(k))));

const PARAMS = { N: 32768, r: 8, p: 1 } as const;
export const MIN_CONTRASENA = 12;

/** «scrypt$N$r$p$sal$hash» (base64): los parámetros viajan con el hash para poder subirlos después. */
export async function hashear(contrasena: string): Promise<string> {
  const sal = randomBytes(16);
  const k = await scrypt(contrasena.normalize("NFKC"), sal, 32, { ...PARAMS, maxmem: 128 * 1024 * 1024 });
  return ["scrypt", PARAMS.N, PARAMS.r, PARAMS.p, sal.toString("base64"), k.toString("base64")].join("$");
}

export async function verificar(contrasena: string, guardado: string): Promise<boolean> {
  const [alg, n, r, p, sal, hash] = guardado.split("$");
  if (alg !== "scrypt" || !sal || !hash) return false;
  const esperado = Buffer.from(hash, "base64");
  const k = await scrypt(contrasena.normalize("NFKC"), Buffer.from(sal, "base64"), esperado.length, { N: Number(n), r: Number(r), p: Number(p), maxmem: 128 * 1024 * 1024 });
  return k.length === esperado.length && timingSafeEqual(k, esperado);
}

export async function leerHash(): Promise<string | null> {
  const { rows } = await getPool().query(`select hash from acceso where id = 1`);
  return (rows[0]?.hash as string | undefined) ?? null;
}

/** Guarda la contraseña. `soloSiNoHay` evita que alguien «cree» una encima de la tuya. Devuelve si la guardó. */
export async function guardarHash(hash: string, soloSiNoHay: boolean): Promise<boolean> {
  const { rowCount } = soloSiNoHay
    ? await getPool().query(`insert into acceso (id, hash) values (1, $1) on conflict (id) do nothing`, [hash])
    : await getPool().query(`insert into acceso (id, hash) values (1, $1) on conflict (id) do update set hash = excluded.hash, actualizado_en = now()`, [hash]);
  return (rowCount ?? 0) > 0;
}

// ---------------------------------------------------------------------------------------------------------------
// Límite de intentos (contra quien pruebe contraseñas a lo bruto)

const MAX_FALLOS = 5;
const BLOQUEO_MS = 15 * 60_000;

export interface Intentos {
  fallos: number;
  /** Hasta cuándo está bloqueado (0 = no está bloqueado). */
  hasta: number;
}

/** Minutos que le faltan de bloqueo a este origen (0 = puede intentar). Tras 5 fallos seguidos espera 15 minutos. */
export function bloqueado(tabla: Map<string, Intentos>, clave: string, ahora = Date.now()): number {
  const i = tabla.get(clave);
  if (!i || i.hasta <= ahora) return 0;
  return Math.ceil((i.hasta - ahora) / 60_000);
}

export function registrarIntento(tabla: Map<string, Intentos>, clave: string, ok: boolean, ahora = Date.now()) {
  if (ok) {
    tabla.delete(clave);
    return;
  }
  const previo = tabla.get(clave);
  // Un bloqueo que ya venció empieza la cuenta de nuevo.
  const fallos = (previo && !(previo.hasta && previo.hasta <= ahora) ? previo.fallos : 0) + 1;
  tabla.set(clave, { fallos, hasta: fallos >= MAX_FALLOS ? ahora + BLOQUEO_MS : 0 });
  // Que la tabla no crezca sin fin con orígenes viejos.
  if (tabla.size > 10_000) for (const [k, v] of tabla) if (v.hasta && v.hasta <= ahora) tabla.delete(k);
}
