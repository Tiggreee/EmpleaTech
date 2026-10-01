import { describe, expect, it } from "vitest";
import { DURACION, crearToken, leerToken, rutaPublica, secretoDeSesion } from "./sesion";

const SECRETO = "secreto-de-prueba-unitaria-0123456789-abcdef";
const AHORA = Date.UTC(2026, 8, 29, 12);

describe("tokens de sesión y de la extensión", () => {
  const SELLO = "0123456789abcdef0123456789abcdef";

  it("un token recién creado vale para su tipo y hasta que vence, y trae el sello de la cuenta", async () => {
    const t = await crearToken("sesion", SECRETO, SELLO, AHORA);
    expect(t).toMatch(/^sesion\.[a-f0-9]{32}\.\d+\.[A-Za-z0-9_-]+$/);
    expect(await leerToken(t, "sesion", SECRETO, AHORA)).toEqual({ sello: SELLO });
    expect(await leerToken(t, "sesion", SECRETO, AHORA + (DURACION.sesion - 1) * 1000)).not.toBeNull();
    expect(await leerToken(t, "sesion", SECRETO, AHORA + (DURACION.sesion + 1) * 1000)).toBeNull();
    const paso2 = await crearToken("paso2", SECRETO, SELLO, AHORA);
    expect(await leerToken(paso2, "paso2", SECRETO, AHORA + 4 * 60_000)).not.toBeNull();
    expect(await leerToken(paso2, "paso2", SECRETO, AHORA + 6 * 60_000)).toBeNull();
  });

  it("no sirve alterado, de otro tipo, con otro secreto ni mal formado", async () => {
    const t = await crearToken("extension", SECRETO, SELLO, AHORA);
    const [tipo, sello, vence, firma] = t.split(".");
    expect(await leerToken(`${tipo}.${sello}.${Number(vence) + 999_999}.${firma}`, "extension", SECRETO, AHORA)).toBeNull();
    expect(await leerToken(`${tipo}.${"f".repeat(32)}.${vence}.${firma}`, "extension", SECRETO, AHORA)).toBeNull();
    expect(await leerToken(`${tipo}.${sello}.${vence}.${firma.slice(0, -1)}A`, "extension", SECRETO, AHORA)).toBeNull();
    expect(await leerToken(t, "sesion", SECRETO, AHORA)).toBeNull();
    expect(await leerToken(t, "extension", `${SECRETO}-otro`, AHORA)).toBeNull();
    for (const malo of ["", "sesion", "a.b.c", "a.b.c.d.e", null, undefined]) expect(await leerToken(malo, "sesion", SECRETO, AHORA)).toBeNull();
    await expect(crearToken("sesion", SECRETO, "no-es-un-sello", AHORA)).rejects.toThrow(/Sello/);
  });

  it("exige un secreto largo: sin él nadie entra", () => {
    expect(() => secretoDeSesion({ EMPLEATECH_SECRETO: "corto" })).toThrow(/EMPLEATECH_SECRETO/);
    expect(secretoDeSesion({ EMPLEATECH_SECRETO: SECRETO })).toBe(SECRETO);
  });
});

describe("rutas sin sesión", () => {
  it("solo la entrada y lo que el navegador pide solo", () => {
    for (const r of ["/entrar", "/privacidad", "/api/acceso", "/icon/32", "/manifest.webmanifest", "/robots.txt", "/sw.js", "/opengraph-image"]) expect(rutaPublica(r), r).toBe(true);
    for (const r of ["/", "/hoy", "/perfil", "/api/state", "/api/autollenado", "/entrar-falso", "/privacidad/x", "/api/vacantes"]) expect(rutaPublica(r), r).toBe(false);
  });
});
