import { describe, expect, it } from "vitest";
import { DURACION, crearToken, rutaPublica, secretoDeSesion, tokenValido } from "./sesion";

const SECRETO = "secreto-de-prueba-unitaria-0123456789-abcdef";
const AHORA = Date.UTC(2026, 8, 29, 12);

describe("tokens de sesión y de la extensión", () => {
  it("un token recién creado vale para su tipo y hasta que vence", async () => {
    const t = await crearToken("sesion", SECRETO, AHORA);
    expect(t).toMatch(/^sesion\.\d+\.[A-Za-z0-9_-]+$/);
    expect(await tokenValido(t, "sesion", SECRETO, AHORA)).toBe(true);
    expect(await tokenValido(t, "sesion", SECRETO, AHORA + (DURACION.sesion - 1) * 1000)).toBe(true);
    expect(await tokenValido(t, "sesion", SECRETO, AHORA + (DURACION.sesion + 1) * 1000)).toBe(false);
  });

  it("no sirve alterado, de otro tipo, con otro secreto ni mal formado", async () => {
    const t = await crearToken("extension", SECRETO, AHORA);
    const [tipo, vence, firma] = t.split(".");
    expect(await tokenValido(`${tipo}.${Number(vence) + 999_999}.${firma}`, "extension", SECRETO, AHORA)).toBe(false);
    expect(await tokenValido(`${tipo}.${vence}.${firma.slice(0, -1)}A`, "extension", SECRETO, AHORA)).toBe(false);
    expect(await tokenValido(t, "sesion", SECRETO, AHORA)).toBe(false);
    expect(await tokenValido(t, "extension", `${SECRETO}-otro`, AHORA)).toBe(false);
    for (const malo of ["", "sesion", "a.b.c.d", null, undefined]) expect(await tokenValido(malo, "sesion", SECRETO, AHORA)).toBe(false);
  });

  it("exige un secreto largo: sin él nadie entra", () => {
    expect(() => secretoDeSesion({ EMPLEATECH_SECRETO: "corto" })).toThrow(/EMPLEATECH_SECRETO/);
    expect(secretoDeSesion({ EMPLEATECH_SECRETO: SECRETO })).toBe(SECRETO);
  });
});

describe("rutas sin sesión", () => {
  it("solo la entrada y lo que el navegador pide solo", () => {
    for (const r of ["/entrar", "/api/acceso", "/icon/32", "/manifest.webmanifest", "/robots.txt", "/sw.js", "/opengraph-image"]) expect(rutaPublica(r), r).toBe(true);
    for (const r of ["/", "/hoy", "/perfil", "/api/state", "/api/autollenado", "/entrar-falso", "/api/vacantes"]) expect(rutaPublica(r), r).toBe(false);
  });
});
