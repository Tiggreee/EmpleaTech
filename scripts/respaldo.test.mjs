import path from "node:path";
import { describe, expect, it } from "vitest";
import { carpetaDatos } from "./entorno.mjs";
import { aConservar, fechaDeNombre, nombreDeRespaldo } from "./respaldo.mjs";

const diario = (desde, dias) =>
  Array.from({ length: dias }, (_, i) => nombreDeRespaldo(new Date(desde.getFullYear(), desde.getMonth(), desde.getDate() - i, 3, 0, 0)));

describe("nombres de respaldo", () => {
  it("se leen de vuelta a la misma fecha, con o sin motivo", () => {
    const f = new Date(2026, 8, 29, 4, 15, 9);
    expect(nombreDeRespaldo(f)).toBe("empleatech-2026-09-29_041509.dump");
    expect(nombreDeRespaldo(f, "antes-de-restaurar")).toBe("empleatech-2026-09-29_041509-antes-de-restaurar.dump");
    expect(fechaDeNombre(nombreDeRespaldo(f))?.getTime()).toBe(f.getTime());
    expect(fechaDeNombre(nombreDeRespaldo(f, "antes-de-restaurar"))?.getTime()).toBe(f.getTime());
  });

  it("ignora archivos que no son respaldos nuestros", () => {
    for (const n of ["notas.txt", "empleatech-2026-09-29_041509.dump.parcial", "otro-2026-09-29_041509.dump", "empleatech-ayer.dump"]) {
      expect(fechaDeNombre(n), n).toBeNull();
    }
  });
});

describe("aConservar (rotación)", () => {
  it("con pocos respaldos no borra nada", () => {
    const nombres = diario(new Date(2026, 8, 29), 10);
    expect(aConservar(nombres).size).toBe(10);
  });

  it("guarda los 14 más recientes y uno por semana de las 8 anteriores", () => {
    const nombres = diario(new Date(2026, 8, 29), 120);
    const quedan = [...aConservar(nombres)].sort().reverse();
    expect(quedan.slice(0, 14)).toEqual(nombres.slice(0, 14));
    const viejos = quedan.slice(14).map((n) => fechaDeNombre(n));
    expect(viejos).toHaveLength(8);
    // Uno por semana de calendario (lunes a domingo), en semanas consecutivas.
    const semana = (f) => Math.floor((f - new Date(1970, 0, 5)) / (7 * 86_400_000));
    const semanas = viejos.map(semana);
    for (let i = 1; i < semanas.length; i++) expect(semanas[i - 1] - semanas[i]).toBe(1);
  });

  it("nunca incluye nombres ajenos", () => {
    expect(aConservar(["notas.txt", ...diario(new Date(2026, 8, 29), 3)]).has("notas.txt")).toBe(false);
  });
});

describe("carpetaDatos", () => {
  it("vive fuera del repositorio, en la carpeta de datos de cada sistema", () => {
    expect(carpetaDatos({ LOCALAPPDATA: "C:\\Users\\ana\\AppData\\Local" }, "win32", "C:\\Users\\ana")).toBe(path.join("C:\\Users\\ana\\AppData\\Local", "EmpleaTech"));
    expect(carpetaDatos({}, "linux", "/home/ana")).toBe(path.join("/home/ana", ".local", "share", "empleatech"));
    expect(carpetaDatos({}, "darwin", "/Users/ana")).toBe(path.join("/Users/ana", "Library", "Application Support", "EmpleaTech"));
  });

  it("respeta EMPLEATECH_DATOS si la defines", () => {
    expect(carpetaDatos({ EMPLEATECH_DATOS: "/datos/empleatech" }, "linux", "/home/ana")).toBe(path.resolve("/datos/empleatech"));
  });
});
