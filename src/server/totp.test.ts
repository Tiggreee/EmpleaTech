import { describe, expect, it } from "vitest";
import {
  aBase32,
  cifrar,
  codigoTotp,
  deBase32,
  descifrar,
  huellaRespaldo,
  nuevosCodigosRespaldo,
  pareceRespaldo,
  pasoDe,
  secretoLegible,
  uriTotp,
  verificarTotp,
} from "./totp";

// Vectores de prueba del RFC 6238 (apéndice B), variante SHA-1.
const SECRETO_RFC = Buffer.from("12345678901234567890", "ascii");
const VECTORES: [number, string][] = [
  [59, "94287082"],
  [1111111109, "07081804"],
  [1111111111, "14050471"],
  [1234567890, "89005924"],
  [2000000000, "69279037"],
  [20000000000, "65353130"],
];

describe("TOTP", () => {
  it("coincide con los vectores del RFC 6238", () => {
    for (const [t, esperado] of VECTORES) {
      expect(codigoTotp(SECRETO_RFC, pasoDe(t * 1000), 8), String(t)).toBe(esperado);
      expect(codigoTotp(SECRETO_RFC, pasoDe(t * 1000)), String(t)).toBe(esperado.slice(-6));
    }
  });

  it("base32 de ida y vuelta, como lo leen las apps", () => {
    expect(aBase32(Buffer.from("12345678901234567890"))).toBe("GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ");
    expect(deBase32("gezd gnbv-gy3t qojq gezdgnbvgy3tqojq==").toString()).toBe("12345678901234567890");
    expect(() => deBase32("no-es-base32!")).toThrow();
    expect(secretoLegible(SECRETO_RFC)).toBe("GEZD GNBV GY3T QOJQ GEZD GNBV GY3T QOJQ");
  });

  it("acepta el código actual y el de 30 s antes o después, no más", () => {
    const ahora = 1_790_000_000_000;
    const p = pasoDe(ahora);
    expect(verificarTotp(SECRETO_RFC, codigoTotp(SECRETO_RFC, p), ahora, null)).toBe(p);
    expect(verificarTotp(SECRETO_RFC, codigoTotp(SECRETO_RFC, p - 1), ahora, null)).toBe(p - 1);
    expect(verificarTotp(SECRETO_RFC, codigoTotp(SECRETO_RFC, p + 1), ahora, null)).toBe(p + 1);
    expect(verificarTotp(SECRETO_RFC, codigoTotp(SECRETO_RFC, p - 3), ahora, null)).toBeNull();
    expect(verificarTotp(SECRETO_RFC, "12345", ahora, null)).toBeNull();
    expect(verificarTotp(SECRETO_RFC, "abcdef", ahora, null)).toBeNull();
  });

  it("un código ya usado no sirve otra vez (ni uno más viejo)", () => {
    const ahora = 1_790_000_000_000;
    const p = pasoDe(ahora);
    expect(verificarTotp(SECRETO_RFC, codigoTotp(SECRETO_RFC, p), ahora, p)).toBeNull();
    expect(verificarTotp(SECRETO_RFC, codigoTotp(SECRETO_RFC, p - 1), ahora, p)).toBeNull();
    expect(verificarTotp(SECRETO_RFC, codigoTotp(SECRETO_RFC, p + 1), ahora, p)).toBe(p + 1);
  });

  it("arma la dirección otpauth que leen las apps de autenticación", () => {
    const uri = uriTotp(SECRETO_RFC, "empleatech.ejemplo.dev");
    expect(uri).toBe("otpauth://totp/EmpleaTech:empleatech.ejemplo.dev?secret=GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ&issuer=EmpleaTech&algorithm=SHA1&digits=6&period=30");
  });
});

describe("códigos de respaldo", () => {
  it("son distintos, legibles y se guardan solo como huella", () => {
    const codigos = nuevosCodigosRespaldo();
    expect(codigos).toHaveLength(8);
    expect(new Set(codigos).size).toBe(8);
    for (const c of codigos) {
      expect(c).toMatch(/^[a-z2-7]{5}-[a-z2-7]{5}$/);
      expect(pareceRespaldo(c)).toBe(true);
      expect(huellaRespaldo(c)).toMatch(/^[a-f0-9]{64}$/);
    }
    // Da igual cómo lo teclees.
    expect(huellaRespaldo(codigos[0].toUpperCase().replace("-", " "))).toBe(huellaRespaldo(codigos[0]));
    expect(pareceRespaldo("123456")).toBe(false);
  });
});

describe("secreto cifrado", () => {
  const S = "secreto-de-prueba-unitaria-0123456789-abcdef";

  it("de ida y vuelta con el mismo EMPLEATECH_SECRETO; con otro o alterado, no", () => {
    const c = cifrar(SECRETO_RFC, S);
    expect(c).toMatch(/^v1\.[\w-]+\.[\w-]+\.[\w-]+$/);
    expect(c).not.toContain(aBase32(SECRETO_RFC));
    expect(cifrar(SECRETO_RFC, S)).not.toBe(c); // IV distinto cada vez
    expect(descifrar(c, S)?.equals(SECRETO_RFC)).toBe(true);
    expect(descifrar(c, `${S}-otro`)).toBeNull();
    const [v, iv, tag, datos] = c.split(".");
    expect(descifrar([v, iv, tag, `${datos.slice(0, -2)}AA`].join("."), S)).toBeNull();
    expect(descifrar("basura", S)).toBeNull();
  });
});
