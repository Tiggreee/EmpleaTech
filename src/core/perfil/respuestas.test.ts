import { describe, expect, it } from "vitest";
import { PREFIERO_NO_DECIR, RESPUESTAS_VACIAS, fechaDeInicio, pendientes, sanitizarRespuestas } from "./respuestas";

const COMPLETAS = {
  salario: { monto: 55000, moneda: "MXN", periodo: "mes" },
  disponibilidad: "2-semanas",
  modalidades: ["remoto", "hibrido"],
  reubicacion: false,
  paisesAutorizado: ["mx"],
  requierePatrocinio: true,
  aniosExperiencia: 6,
  nivelIngles: "avanzado",
};

describe("respuestas frecuentes", () => {
  it("sin respuestas, todo está pendiente y la diversidad es «prefiero no decir»", () => {
    const r = sanitizarRespuestas(undefined);
    expect(pendientes(r)).toHaveLength(7);
    expect(Object.values(r.diversidad)).toEqual([PREFIERO_NO_DECIR, PREFIERO_NO_DECIR, PREFIERO_NO_DECIR, PREFIERO_NO_DECIR]);
  });

  it("respuestas completas no dejan pendientes y normalizan países", () => {
    const r = sanitizarRespuestas(COMPLETAS);
    expect(pendientes(r)).toEqual([]);
    expect(r.paisesAutorizado).toEqual(["MX"]);
    expect(r.salario).toEqual({ monto: 55000, moneda: "MXN", periodo: "mes" });
  });

  it("descarta valores fuera de catálogo o absurdos", () => {
    const r = sanitizarRespuestas({
      salario: { monto: -5, moneda: "MXN", periodo: "mes" },
      disponibilidad: "cuando sea",
      modalidades: ["remoto", "remoto", "a la luna"],
      paisesAutorizado: ["México", "US", 3],
      aniosExperiencia: 200,
      nivelIngles: "experto",
      requierePatrocinio: "sí",
    });
    expect(r.salario).toBeUndefined();
    expect(r.disponibilidad).toBeUndefined();
    expect(r.modalidades).toEqual(["remoto"]);
    expect(r.paisesAutorizado).toEqual(["US"]);
    expect(r.aniosExperiencia).toBeUndefined();
    expect(r.nivelIngles).toBeUndefined();
    expect(r.requierePatrocinio).toBeUndefined();
  });

  it("«a partir de una fecha» sin fecha sigue pendiente", () => {
    const r = sanitizarRespuestas({ ...COMPLETAS, disponibilidad: "fecha", fechaInicio: "no" });
    expect(pendientes(r)).toEqual(["disponibilidad"]);
    expect(pendientes(sanitizarRespuestas({ ...COMPLETAS, disponibilidad: "fecha", fechaInicio: "2026-11-02" }))).toEqual([]);
  });

  it("convierte la disponibilidad en una fecha concreta para formularios", () => {
    const hoy = new Date("2026-09-28T12:00:00Z");
    expect(fechaDeInicio(sanitizarRespuestas(COMPLETAS), hoy)).toBe("2026-10-12");
    expect(fechaDeInicio(sanitizarRespuestas({ ...COMPLETAS, disponibilidad: "inmediata" }), hoy)).toBe("2026-09-28");
    expect(fechaDeInicio(RESPUESTAS_VACIAS, hoy)).toBeUndefined();
  });

  it("es estable: sanitizar dos veces da lo mismo", () => {
    const una = sanitizarRespuestas(COMPLETAS);
    expect(sanitizarRespuestas(JSON.parse(JSON.stringify(una)))).toEqual(una);
  });
});
