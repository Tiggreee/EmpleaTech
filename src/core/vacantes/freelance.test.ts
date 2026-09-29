import { describe, expect, it } from "vitest";
import { sanitizarRespuestas } from "../perfil/respuestas";
import { coincidePalabras, palabraClave, puntuar } from "./busqueda";
import { MAX_FUENTES_ACTIVAS, esFuenteFreelance } from "./fuentes";
import { FUENTES_INICIALES, sanitizarPreferencias, type PreferenciasBusqueda } from "./preferencias";
import { crearVacante, type Vacante } from "./vacante";

const AHORA = new Date("2026-09-29T12:00:00Z");
const CV = "Desarrollador Java\nExperiencia\n- APIs REST con Java, Spring Boot y PostgreSQL.\nHabilidades\nJava, Spring Boot, PostgreSQL, Docker";

function proyecto(parcial: Partial<Vacante> = {}): Vacante {
  const v = crearVacante("freelancer", {
    idExterno: "1",
    titulo: parcial.titulo ?? "Android GPS Tracker App",
    empresa: "Cliente de Freelancer.com",
    url: "https://www.freelancer.com/projects/android/x",
    descripcion: parcial.descripcion ?? "Necesito una API REST en Java con Spring Boot y PostgreSQL.",
    publicadaEn: "2026-09-20T00:00:00Z",
    etiquetas: parcial.etiquetas ?? ["Java", "Android"],
    tipo: "proyecto",
    propuestas: parcial.propuestas,
  });
  if (!v) throw new Error("proyecto inválido en la prueba");
  return v;
}

describe("búsqueda de proyectos freelance", () => {
  it("la palabra clave nunca es el nivel del puesto", () => {
    expect(palabraClave("Senior Java Software Engineer")).toBe("java");
    expect(palabraClave("Sr. Desarrolladora Backend")).toBe("backend");
    expect(palabraClave("Lead Engineer")).toBe("engineer");
  });

  it("un proyecto coincide por la habilidad principal, aunque el título no diga el puesto", () => {
    expect(coincidePalabras(proyecto(), ["java software engineer"])).toBe(true);
    expect(coincidePalabras(proyecto({ etiquetas: ["PHP"] }), ["java software engineer"])).toBe(false);
  });

  it("un empleo sigue pidiendo todas las palabras importantes del puesto", () => {
    const empleo = { ...proyecto(), tipo: undefined };
    expect(coincidePalabras(empleo, ["java software engineer"])).toBe(false);
  });

  it("pocas propuestas suman: llegar entre los primeros importa; muchas restan", () => {
    const r = sanitizarRespuestas({});
    const base = puntuar(proyecto(), CV, r, AHORA).prioridad.valor ?? 0;
    const temprano = puntuar(proyecto({ propuestas: 3 }), CV, r, AHORA);
    const saturado = puntuar(proyecto({ propuestas: 120 }), CV, r, AHORA);
    expect(temprano.prioridad.valor).toBe(Math.min(100, base + 5));
    expect(temprano.prioridad.factores.join(" ")).toMatch(/3 propuestas/);
    expect(saturado.prioridad.valor).toBe(Math.max(0, base - 5));
    expect(saturado.prioridad.factores.join(" ")).toMatch(/120 propuestas/);
  });
});

describe("plataformas freelance en las preferencias", () => {
  const base: PreferenciasBusqueda = { fuentes: FUENTES_INICIALES, palabras: [], soloRemoto: true, empresas: { greenhouse: [], lever: [], ashby: [] }, maxPorFuente: 60, metaDiaria: 50, topePorFuente: 10 };

  it("son un extra: no cuentan contra el tope de plataformas de empleo", () => {
    expect(esFuenteFreelance("freelancer")).toBe(true);
    expect(esFuenteFreelance("remotive")).toBe(false);
    const p = sanitizarPreferencias({ fuentes: ["remotive", "jobicy", "lever", "ashby", "adzuna", "jooble", "freelancer", "braintrust"] }, base);
    expect(p.fuentes.filter((f) => !esFuenteFreelance(f))).toHaveLength(MAX_FUENTES_ACTIVAS);
    expect(p.fuentes).toEqual(["remotive", "jobicy", "lever", "ashby", "adzuna", "freelancer", "braintrust"]);
  });
});
