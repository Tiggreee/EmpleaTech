import { describe, expect, it } from "vitest";
import { sanitizarRespuestas } from "../perfil/respuestas";
import { clasificar, elegirOpcion, valorSiNo, valorTexto, type DatosAutollenado } from "./campos";
import { estudioMasAlto, nivelDeEstudio } from "./estudios";

const HOY = new Date("2026-09-29T12:00:00Z");

// Datos ficticios: una licenciatura terminada y un bootcamp reciente, como muchos perfiles que cambian de carrera.
const EDUCACION = [
  { institution: "Academia Ejemplo", studyType: "Full Stack Developer Program", startDate: "2025-01", endDate: "2026-03" },
  { institution: "Universidad Ejemplo", studyType: "B.A.", area: "International Trade and Business", startDate: "2009-08", endDate: "2013-06" },
];

const datos = (estudios = estudioMasAlto(EDUCACION, HOY)): DatosAutollenado => ({
  nombre: "Laura",
  apellido: "Méndez",
  nombreCompleto: "Laura Méndez",
  respuestas: sanitizarRespuestas({}),
  aprendidas: {},
  estudios,
});

describe("nivel de estudios", () => {
  it("reconoce títulos en inglés y español; un bootcamp o programa no es un título", () => {
    expect(nivelDeEstudio({ studyType: "B.A.", area: "International Trade" })).toBe("licenciatura");
    expect(nivelDeEstudio({ studyType: "Ingeniería en Sistemas Computacionales" })).toBe("licenciatura");
    expect(nivelDeEstudio({ studyType: "Maestría", area: "Ciencia de Datos" })).toBe("maestria");
    expect(nivelDeEstudio({ studyType: "MBA" })).toBe("maestria");
    expect(nivelDeEstudio({ studyType: "Ph.D.", area: "Physics" })).toBe("doctorado");
    expect(nivelDeEstudio({ studyType: "Bachillerato" })).toBe("preparatoria");
    expect(nivelDeEstudio({ studyType: "Full Stack Developer Program" })).toBeUndefined();
    expect(nivelDeEstudio({ studyType: "Bootcamp de Desarrollo Web" })).toBeUndefined();
  });

  it("usa tu estudio terminado de mayor nivel, no el más reciente", () => {
    expect(estudioMasAlto(EDUCACION, HOY)).toEqual({ nivel: "licenciatura", escuela: "Universidad Ejemplo", carrera: "International Trade and Business", anioFin: "2013" });
  });

  it("una maestría en curso todavía no cuenta", () => {
    const conMaestria = [...EDUCACION, { institution: "Otra Universidad", studyType: "Master of Science", startDate: "2025-09" }];
    expect(estudioMasAlto(conMaestria, HOY)?.nivel).toBe("licenciatura");
    const porTerminar = [...EDUCACION, { institution: "Otra Universidad", studyType: "Master of Science", startDate: "2025-09", endDate: "2027-06" }];
    expect(estudioMasAlto(porTerminar, HOY)?.nivel).toBe("licenciatura");
  });
});

describe("preguntas de educación en formularios", () => {
  it("clasifica las preguntas comunes y no confunde «carrera» con trayectoria", () => {
    expect(clasificar("What is your highest level of education?")).toBe("nivelEstudios");
    expect(clasificar("Nivel máximo de estudios")).toBe("nivelEstudios");
    expect(clasificar("Degree")).toBe("nivelEstudios");
    expect(clasificar("School")).toBe("escuela");
    expect(clasificar("Universidad")).toBe("escuela");
    expect(clasificar("Field of study")).toBe("carrera");
    expect(clasificar("Graduation year")).toBe("anioGraduacion");
    expect(clasificar("Do you have a Bachelor's degree?")).toBe("tieneTitulo");
    expect(clasificar("¿Cuentas con título universitario?")).toBe("tieneTitulo");
    expect(clasificar("Cuéntanos sobre tu carrera")).not.toBe("carrera");
  });

  it("contesta con tu licenciatura en el idioma del formulario", () => {
    const d = datos();
    expect(valorTexto("nivelEstudios", d, "en", HOY)).toBe("Bachelor's degree");
    expect(valorTexto("nivelEstudios", d, "es", HOY)).toBe("Licenciatura");
    expect(valorTexto("escuela", d, "en", HOY)).toBe("Universidad Ejemplo");
    expect(valorTexto("carrera", d, "en", HOY)).toBe("International Trade and Business");
    expect(valorTexto("anioGraduacion", d, "en", HOY)).toBe("2013");
  });

  it("elige la opción correcta y nunca «Some college» ni «trunca»", () => {
    const d = datos();
    expect(elegirOpcion("nivelEstudios", d, "Highest level of education", ["High School", "Some College", "Associate's Degree", "Bachelor's Degree", "Master's Degree", "Doctorate"])).toBe(3);
    expect(elegirOpcion("nivelEstudios", d, "Nivel de estudios", ["Preparatoria", "Licenciatura trunca", "Licenciatura", "Maestría"])).toBe(2);
    expect(elegirOpcion("carrera", d, "Field of study", ["Computer Science", "International Trade and Business"])).toBe(1);
  });

  it("sí/no según el nivel que piden; si piden una carrera específica, se deja para ti", () => {
    const d = datos();
    expect(valorSiNo("tieneTitulo", d, "Do you have a Bachelor's degree?")).toBe(true);
    expect(valorSiNo("tieneTitulo", d, "Do you have a high school diploma or equivalent?")).toBe(true);
    expect(valorSiNo("tieneTitulo", d, "Do you have a Master's degree?")).toBe(false);
    expect(valorSiNo("tieneTitulo", d, "Do you have a Bachelor's degree in Computer Science or a related field?")).toBeUndefined();
    // Sin un título en el CV no se contesta «no»: puede que el CV simplemente no lo diga.
    expect(valorSiNo("tieneTitulo", { ...d, estudios: undefined }, "Do you have a Bachelor's degree?")).toBeUndefined();
    expect(elegirOpcion("tieneTitulo", d, "Do you have a Bachelor's degree?", ["Yes", "No"])).toBe(0);
  });
});
