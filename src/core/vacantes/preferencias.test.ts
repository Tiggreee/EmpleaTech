import { describe, expect, it } from "vitest";
import { leerPerfil } from "../perfil/estructurado";
import { sanitizarRespuestas } from "../perfil/respuestas";
import { FUENTES_INICIALES, consultaDe, palabrasDelPerfil, preferenciasIniciales, sanitizarPreferencias } from "./preferencias";

const EMPRESAS = { greenhouse: ["gitlab"], lever: [], ashby: [] };

describe("preferencias de búsqueda", () => {
  it("las palabras salen del perfil sin niveles de seniority", () => {
    const { perfil } = leerPerfil("Ana Torres\nDesarrolladora Backend Senior\n\nExperiencia\nSr. Data Engineer — Acme\n2020 - 2023\n- ETL");
    expect(palabrasDelPerfil(perfil)).toEqual(["Desarrolladora Backend", "Data Engineer"]);
  });

  it("valores iniciales: 5 fuentes, solo remoto si solo acepta remoto", () => {
    const p = preferenciasIniciales(undefined, sanitizarRespuestas({ modalidades: ["remoto"] }), EMPRESAS);
    expect(p.fuentes).toEqual(FUENTES_INICIALES);
    expect(p.soloRemoto).toBe(true);
    expect(preferenciasIniciales(undefined, sanitizarRespuestas({ modalidades: ["remoto", "hibrido"] }), EMPRESAS).soloRemoto).toBe(false);
  });

  it("limita a 5 fuentes válidas, limpia tableros y acota el máximo por fuente", () => {
    const base = preferenciasIniciales(undefined, sanitizarRespuestas({}), EMPRESAS);
    const p = sanitizarPreferencias({ fuentes: ["remotive", "x", "jobicy", "lever", "ashby", "adzuna", "jooble"], empresas: { lever: ["Toptal", "../x"] }, maxPorFuente: 9999 }, base);
    expect(p.fuentes).toEqual(["remotive", "jobicy", "lever", "ashby", "adzuna"]);
    expect(p.empresas.lever).toEqual(["toptal"]);
    expect(p.empresas.greenhouse).toEqual(["gitlab"]);
    expect(p.maxPorFuente).toBe(200);
  });

  it("la consulta usa los países donde puedes trabajar", () => {
    const r = sanitizarRespuestas({ paisesAutorizado: ["MX"] });
    expect(consultaDe(preferenciasIniciales(undefined, r, EMPRESAS), r).paises).toEqual(["MX"]);
  });
});
