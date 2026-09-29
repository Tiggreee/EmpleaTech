import { describe, expect, it } from "vitest";
import { bloqueado, hashear, registrarIntento, verificar, type Intentos } from "./contrasena";

describe("contraseña", () => {
  it("se guarda solo como hash scrypt con sal, y verifica la correcta y ninguna otra", async () => {
    const h = await hashear("una frase larga de prueba");
    expect(h).toMatch(/^scrypt\$32768\$8\$1\$[A-Za-z0-9+/=]+\$[A-Za-z0-9+/=]+$/);
    expect(h).not.toContain("una frase");
    expect(await hashear("una frase larga de prueba")).not.toBe(h); // sal distinta cada vez
    expect(await verificar("una frase larga de prueba", h)).toBe(true);
    expect(await verificar("una frase larga de prueba ", h)).toBe(false);
    expect(await verificar("otra", h)).toBe(false);
    expect(await verificar("una frase larga de prueba", "md5$lo-que-sea")).toBe(false);
  });
});

describe("límite de intentos", () => {
  const T = Date.UTC(2026, 8, 29, 12);

  it("tras 5 fallos seguidos bloquea 15 minutos; un acierto limpia la cuenta", () => {
    const tabla = new Map<string, Intentos>();
    for (let i = 0; i < 4; i++) registrarIntento(tabla, "ip", false, T);
    expect(bloqueado(tabla, "ip", T)).toBe(0);
    registrarIntento(tabla, "ip", false, T);
    expect(bloqueado(tabla, "ip", T)).toBe(15);
    expect(bloqueado(tabla, "otra-ip", T)).toBe(0);
    expect(bloqueado(tabla, "ip", T + 15 * 60_000 + 1)).toBe(0);

    registrarIntento(tabla, "ip2", false, T);
    registrarIntento(tabla, "ip2", true, T);
    expect(tabla.has("ip2")).toBe(false);
  });

  it("cuando vence el bloqueo, la cuenta empieza de nuevo", () => {
    const tabla = new Map<string, Intentos>();
    for (let i = 0; i < 5; i++) registrarIntento(tabla, "ip", false, T);
    const despues = T + 16 * 60_000;
    registrarIntento(tabla, "ip", false, despues);
    expect(tabla.get("ip")?.fallos).toBe(1);
    expect(bloqueado(tabla, "ip", despues)).toBe(0);
  });
});
