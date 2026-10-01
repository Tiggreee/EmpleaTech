import { describe, expect, it } from "vitest";
import { hashear, verificar } from "./contrasena";

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
