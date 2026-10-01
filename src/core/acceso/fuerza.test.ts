import { describe, expect, it } from "vitest";
import { MAX_CONTRASENA, evaluarContrasena } from "./fuerza";

describe("fuerza de la contraseña", () => {
  it("una frase larga pasa aunque no tenga mayúsculas ni símbolos", () => {
    for (const c of ["una frase larga de prueba", "caballo correcto pila grapa", "Mi gato duerme en la lavadora"]) {
      const r = evaluarContrasena(c);
      expect(r.valida, c).toBe(true);
      expect(r.nivel, c).toBeGreaterThanOrEqual(3);
      expect(r.problemas).toEqual([]);
    }
  });

  it("pide al menos 12 caracteres y dice cuántos llevas", () => {
    const r = evaluarContrasena("corta-9x");
    expect(r.valida).toBe(false);
    expect(r.problemas[0]).toBe("Usa al menos 12 caracteres (llevas 8).");
    expect(evaluarContrasena("x".repeat(MAX_CONTRASENA + 1)).valida).toBe(false);
  });

  it("rechaza secuencias de teclado y del abecedario aunque sean largas", () => {
    for (const c of ["123456789012", "qwertyuiop12", "abcdefghijkl", "0987654321qwe"]) {
      const r = evaluarContrasena(c);
      expect(r.valida, c).toBe(false);
      expect(r.problemas.join(" "), c).toMatch(/secuencias|pocos caracteres/);
    }
  });

  it("rechaza patrones repetidos", () => {
    expect(evaluarContrasena("aaaaaaaaaaaaaa").problemas).toContain("Tiene muy pocos caracteres distintos.");
    expect(evaluarContrasena("abcde1abcde1").problemas).toContain("Es un mismo pedazo repetido; usa una frase.");
  });

  it("rechaza palabras comunes disfrazadas con números y símbolos", () => {
    for (const c of ["P@ssw0rd2024!", "Contraseña123!", "Empleatech2026!", "iloveyou12345"]) {
      const r = evaluarContrasena(c);
      expect(r.valida, c).toBe(false);
      expect(r.problemas, c).toContain("Se basa en una palabra muy común; agrega palabras tuyas.");
    }
  });

  it("también rechaza las palabras propias de esta instalación (por ejemplo, el dominio)", () => {
    expect(evaluarContrasena("vmdev.lat 2026").valida).toBe(true);
    expect(evaluarContrasena("vmdev.lat 2026", ["VMDev"]).valida).toBe(false);
  });

  it("el nivel sube con el largo útil, no con la longitud bruta", () => {
    const debil = evaluarContrasena("123456789012");
    const fuerte = evaluarContrasena("tacos de canasta a las 3 de la tarde");
    expect(debil.nivel).toBeLessThanOrEqual(1);
    expect(fuerte.nivel).toBe(4);
  });
});
