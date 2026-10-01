import { randomBytes, scrypt as scryptCb, timingSafeEqual, type ScryptOptions } from "node:crypto";

const scrypt = (clave: string, sal: Buffer, largo: number, opciones: ScryptOptions) =>
  new Promise<Buffer>((resolve, reject) => scryptCb(clave, sal, largo, opciones, (e, k) => (e ? reject(e) : resolve(k))));

const PARAMS = { N: 32768, r: 8, p: 1 } as const;

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
