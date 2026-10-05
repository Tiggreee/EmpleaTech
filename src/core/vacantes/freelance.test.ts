import { describe, expect, it } from "vitest";
import { sanitizarRespuestas } from "../perfil/respuestas";
import { coincidePalabras, habilidadesFaltantes, palabraClave, puntuar } from "./busqueda";
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
    expect(coincidePalabras(empleo, ["java full stack developer"])).toBe(false);
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

describe("proyectos que no son lo tuyo (casos vistos con datos reales)", () => {
  const resortes = () =>
    proyecto({
      titulo: "Spring and Damper Testing Machine Design",
      descripcion: "Design a testing machine for springs and dampers for an industrial environment.",
      etiquetas: ["Engineering", "Solidworks", "Mechanical Engineering", "3D Modelling"],
    });

  it("«Spring Boot» no trae proyectos de resortes: las habilidades de dos palabras se piden completas", () => {
    expect(coincidePalabras(resortes(), ["spring boot developer"])).toBe(false);
    expect(coincidePalabras(proyecto({ titulo: "Microservicios", etiquetas: ["Spring Boot", "Java"] }), ["spring boot developer"])).toBe(true);
  });

  it("las etiquetas que el catálogo no conoce y no están en tu CV cuentan como faltantes; las generales no", () => {
    expect(habilidadesFaltantes(["Engineering", "Solidworks", "Mechanical Engineering", "Java", "Android"], CV)).toEqual(["Solidworks", "Mechanical Engineering"]);
    expect(habilidadesFaltantes(["Docker", "PostgreSQL"], CV)).toEqual([]);
  });

  it("un proyecto que pide otra especialidad baja aunque el analizador no conozca esas habilidades", () => {
    const r = sanitizarRespuestas({});
    const bueno = puntuar(proyecto({ etiquetas: ["Java", "Spring Boot", "PostgreSQL"] }), CV, r, AHORA);
    const ajeno = puntuar(resortes(), CV, r, AHORA);
    expect(ajeno.prioridad.factores.join(" ")).toMatch(/La mayoría de lo que pide no está en tu CV \(Solidworks, Mechanical Engineering, 3D Modelling…\)/);
    expect(ajeno.prioridad.valor ?? 0).toBeLessThanOrEqual(20);
    expect(ajeno.prioridad.recomendacion).toBe("descartar");
    expect(bueno.prioridad.valor ?? 0).toBeGreaterThan(20);
    // Si solo falta una parte, resta en proporción en vez de descartar.
    const parcial = puntuar(proyecto({ etiquetas: ["Java", "Spring Boot", "PostgreSQL", "Solidworks"] }), CV, r, AHORA);
    expect(parcial.prioridad.factores.join(" ")).toMatch(/no están en tu CV: Solidworks \(−6\)/);
  });

  it("Android y Flutter ya son habilidades conocidas: un proyecto móvil muestra la brecha", () => {
    const movil = puntuar(proyecto({ titulo: "Android food app", descripcion: "Extend our Android app built with Kotlin and Flutter.", etiquetas: ["Android", "Flutter"] }), CV, sanitizarRespuestas({}), AHORA);
    expect(movil.resumen.brechas).toEqual(expect.arrayContaining(["Android", "Flutter"]));
  });
});

describe("plataformas freelance en las preferencias", () => {
  const base: PreferenciasBusqueda = { fuentes: FUENTES_INICIALES, palabras: [], soloRemoto: true, ocultarEntrada: false, empresas: { greenhouse: [], lever: [], ashby: [] }, maxPorFuente: 60, metaDiaria: 50, metaFreelance: 3, topePorFuente: 10 };

  it("son un extra: no cuentan contra el tope de plataformas de empleo", () => {
    expect(esFuenteFreelance("freelancer")).toBe(true);
    expect(esFuenteFreelance("remotive")).toBe(false);
    const p = sanitizarPreferencias({ fuentes: ["remotive", "jobicy", "lever", "ashby", "adzuna", "jooble", "freelancer", "braintrust"] }, base);
    expect(p.fuentes.filter((f) => !esFuenteFreelance(f))).toHaveLength(MAX_FUENTES_ACTIVAS);
    expect(p.fuentes).toEqual(["remotive", "jobicy", "lever", "ashby", "adzuna", "freelancer", "braintrust"]);
  });
});
