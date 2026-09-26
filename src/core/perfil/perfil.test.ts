import { describe, expect, it } from "vitest";
import { MAX_CVS, PERFIL_VACIO, activarCv, actualizarCv, agregarCv, cvActivo, eliminarCv, sanitizarPerfil } from "./perfil";

const T = new Date("2026-09-19T12:00:00Z");
const CV = "Desarrolladora con 4 años de experiencia en JavaScript, TypeScript y React.";

describe("perfil de CV", () => {
  it("el primer CV queda activo automáticamente", () => {
    const e = agregarCv(PERFIL_VACIO, { texto: CV }, T, "a");
    expect(e.activoId).toBe("a");
    expect(e.cvs[0].nombre).toBe("CV 1");
    expect(cvActivo(e)?.id).toBe("a");
  });

  it("el segundo no le quita el activo al primero", () => {
    let e = agregarCv(PERFIL_VACIO, { texto: CV }, T, "a");
    e = agregarCv(e, { nombre: "Versión EN", texto: CV }, T, "b");
    expect(e.activoId).toBe("a");
    expect(activarCv(e, "b").activoId).toBe("b");
  });

  it("rechaza CV demasiado corto o gigante", () => {
    expect(() => agregarCv(PERFIL_VACIO, { texto: "hola" }, T, "a")).toThrow(/corto/);
    expect(() => agregarCv(PERFIL_VACIO, { texto: "x".repeat(60_001) }, T, "a")).toThrow(/límite/);
  });

  it(`limita a ${MAX_CVS} versiones`, () => {
    let e = PERFIL_VACIO;
    for (let i = 0; i < MAX_CVS; i++) e = agregarCv(e, { texto: CV }, T, `id${i}`);
    expect(() => agregarCv(e, { texto: CV }, T, "extra")).toThrow(/hasta 5/);
  });

  it("eliminar el activo pasa el activo al siguiente; el último deja null", () => {
    let e = agregarCv(PERFIL_VACIO, { texto: CV }, T, "a");
    e = agregarCv(e, { texto: CV }, T, "b");
    e = eliminarCv(e, "a");
    expect(e.activoId).toBe("b");
    expect(eliminarCv(e, "b")).toEqual({ activoId: null, cvs: [] });
  });

  it("actualizar valida y sella la fecha", () => {
    let e = agregarCv(PERFIL_VACIO, { texto: CV }, T, "a");
    const t2 = new Date("2026-10-01T00:00:00Z");
    e = actualizarCv(e, "a", { nombre: "  Principal  " }, t2);
    expect(e.cvs[0]).toMatchObject({ nombre: "Principal", actualizadoEn: t2.toISOString() });
    expect(() => actualizarCv(e, "a", { texto: "corto" }, t2)).toThrow();
    expect(() => actualizarCv(e, "zzz", {}, t2)).toThrow(/no encontrado/);
  });

  it("sanitizar descarta basura, corrige el activo huérfano y no revienta", () => {
    const s = sanitizarPerfil({
      activoId: "fantasma",
      cvs: [{ id: "a", nombre: "x", texto: CV }, { id: "a", texto: CV }, { id: "b", texto: "corto" }, null, 7, { texto: CV }],
    });
    expect(s.cvs.map((c) => c.id)).toEqual(["a"]);
    expect(s.activoId).toBe("a");
    expect(sanitizarPerfil("basura")).toEqual(PERFIL_VACIO);
    expect(sanitizarPerfil(null)).toEqual(PERFIL_VACIO);
  });
});
