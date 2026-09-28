import { describe, expect, it } from "vitest";
import { leerPerfil, normalizarFecha, perfilVacio, sanitizarPerfilJson } from "./estructurado";

const CV_ES = `ANA TORRES RAMÍREZ
Desarrolladora Backend Senior
Guadalajara, Jalisco, México | +52 33 1234 5678 | ana.torres@correo.mx
linkedin.com/in/anatorres · github.com/anatorres · anatorres.dev

Resumen
Desarrolladora con 6 años de experiencia construyendo APIs en Node.js y PostgreSQL.

Experiencia profesional
Desarrolladora Backend Senior — Acme Pagos
Ene 2021 – Presente
- Diseñé la API de cobros en Node.js con TypeScript que procesa 2M de transacciones al mes.
- Reduje el tiempo de respuesta 40% con índices en PostgreSQL y caché en Redis.

Globant | Desarrolladora Backend | 03/2018 - 12/2020
- Migré servicios monolíticos a microservicios con Docker y Kubernetes.

Educación
Universidad de Guadalajara
Ingeniería en Computación
2013 - 2017

Habilidades
Node.js, TypeScript, PostgreSQL, Docker, Kubernetes, Redis, Metodologías ágiles, Mentoría

Idiomas
Español: nativo
Inglés: avanzado (C1)

Certificaciones
- AWS Certified Developer – Amazon Web Services, 2022
`;

const CV_EN = `John Carter
Full Stack Engineer
Remote · Bogotá, Colombia
john.carter@mail.com · (555) 123-4567 · https://github.com/jcarter

Professional Summary
Engineer focused on React and Python services.

Work Experience
Stripe                               Jun 2019 - Present
Senior Software Engineer
- Led the migration of billing dashboards to React and TypeScript.
- Built Python data pipelines.

Freelance Developer
2016 - 2019

Education
B.Sc. in Computer Science, University of Toronto, 2016

Skills
React, Python, GraphQL, Figma

Projects
- Carpool: ride sharing app built with React Native https://carpool.app
`;

describe("normalizarFecha", () => {
  it("entiende meses en español e inglés, mm/aaaa y solo año", () => {
    expect(normalizarFecha("ene 2021")).toBe("2021-01");
    expect(normalizarFecha("septiembre de 2019")).toBe("2019-09");
    expect(normalizarFecha("jun. 2019")).toBe("2019-06");
    expect(normalizarFecha("03/2018")).toBe("2018-03");
    expect(normalizarFecha("2017")).toBe("2017");
    expect(normalizarFecha("mañana")).toBeUndefined();
  });
});

describe("leerPerfil: CV en español", () => {
  const { perfil, faltantes } = leerPerfil(CV_ES);

  it("datos de contacto", () => {
    expect(perfil.basics.name).toBe("Ana Torres Ramírez");
    expect(perfil.basics.label).toBe("Desarrolladora Backend Senior");
    expect(perfil.basics.email).toBe("ana.torres@correo.mx");
    expect(perfil.basics.phone).toBe("+52 33 1234 5678");
    expect(perfil.basics.location).toEqual({ city: "Guadalajara", region: "Jalisco", countryCode: "MX" });
    expect(perfil.basics.url).toBe("https://anatorres.dev");
    expect(perfil.basics.profiles).toEqual([
      { network: "LinkedIn", url: "https://linkedin.com/in/anatorres", username: "anatorres" },
      { network: "GitHub", url: "https://github.com/anatorres", username: "anatorres" },
    ]);
    expect(perfil.basics.summary).toMatch(/6 años de experiencia/);
  });

  it("experiencia con puesto, empresa, fechas y logros", () => {
    expect(perfil.work).toHaveLength(2);
    expect(perfil.work[0]).toMatchObject({ position: "Desarrolladora Backend Senior", name: "Acme Pagos", startDate: "2021-01" });
    expect(perfil.work[0].endDate).toBeUndefined();
    expect(perfil.work[0].highlights).toHaveLength(2);
    expect(perfil.work[1]).toMatchObject({ name: "Globant", position: "Desarrolladora Backend", startDate: "2018-03", endDate: "2020-12" });
    expect(perfil.work[1].highlights[0]).toMatch(/microservicios/);
  });

  it("educación", () => {
    expect(perfil.education).toEqual([
      { institution: "Universidad de Guadalajara", studyType: "Ingeniería", area: "Computación", startDate: "2013", endDate: "2017" },
    ]);
  });

  it("habilidades agrupadas e idiomas con nivel", () => {
    const todas = perfil.skills.flatMap((s) => s.keywords);
    expect(todas).toEqual(expect.arrayContaining(["Node.js", "TypeScript", "PostgreSQL", "Docker", "Kubernetes"]));
    expect(perfil.languages).toEqual([
      { language: "Español", fluency: "nativo" },
      { language: "Inglés", fluency: "avanzado" },
    ]);
  });

  it("certificaciones con emisor y año", () => {
    expect(perfil.certificates).toEqual([{ name: "AWS Certified Developer", issuer: "Amazon Web Services", date: "2022" }]);
  });

  it("no marca como faltante lo que sí encontró", () => {
    expect(faltantes).toEqual([]);
  });
});

describe("leerPerfil: CV en inglés con otro acomodo", () => {
  const { perfil } = leerPerfil(CV_EN);

  it("contacto y ubicación remota", () => {
    expect(perfil.basics.name).toBe("John Carter");
    expect(perfil.basics.label).toBe("Full Stack Engineer");
    expect(perfil.basics.email).toBe("john.carter@mail.com");
    expect(perfil.basics.phone).toBe("(555) 123-4567");
    expect(perfil.basics.location?.countryCode).toBe("CO");
    expect(perfil.basics.profiles[0]).toMatchObject({ network: "GitHub", username: "jcarter" });
  });

  it("empresa y fecha en la misma línea, puesto en la siguiente", () => {
    expect(perfil.work[0]).toMatchObject({ name: "Stripe", position: "Senior Software Engineer", startDate: "2019-06" });
    expect(perfil.work[0].highlights).toHaveLength(2);
    expect(perfil.work[1]).toMatchObject({ position: "Freelance Developer", startDate: "2016", endDate: "2019" });
  });

  it("educación en una sola línea", () => {
    expect(perfil.education[0]).toMatchObject({ institution: "University of Toronto", studyType: "B.Sc", endDate: "2016" });
    expect(perfil.education[0].area).toMatch(/Computer Science/);
  });

  it("proyectos con enlace", () => {
    expect(perfil.projects[0]).toMatchObject({ name: "Carpool", url: "https://carpool.app" });
  });
});

describe("leerPerfil: casos difíciles", () => {
  it("un CV sin secciones reconocibles marca lo que falta sin romperse", () => {
    const { perfil, faltantes } = leerPerfil("Hola, soy yo y sé hacer muchas cosas diferentes con computadoras.");
    expect(perfil.basics.name).toBe("");
    expect(faltantes).toEqual(expect.arrayContaining(["nombre", "correo", "telefono", "experiencia", "educacion"]));
  });

  it("no confunde un rango de años con un teléfono", () => {
    const { perfil } = leerPerfil("María López\n2019 - 2022\nmaria@x.com");
    expect(perfil.basics.phone).toBeUndefined();
  });
});

describe("sanitizarPerfilJson", () => {
  it("devuelve un perfil vacío con basura", () => {
    expect(sanitizarPerfilJson(null)).toEqual(perfilVacio());
    expect(sanitizarPerfilJson("x")).toEqual(perfilVacio());
  });

  it("descarta URLs peligrosas, fechas inválidas y correos mal formados", () => {
    const p = sanitizarPerfilJson({
      basics: { name: "  Ana  ", email: "no-es-correo", url: "javascript:alert(1)", profiles: [{ network: "X", url: "ftp://x" }, { network: "GitHub", url: "https://github.com/a" }] },
      work: [{ name: "Acme", startDate: "2020-13", endDate: "2021-02", highlights: ["ok", 5, ""] }],
    });
    expect(p.basics.name).toBe("Ana");
    expect(p.basics.email).toBeUndefined();
    expect(p.basics.url).toBeUndefined();
    expect(p.basics.profiles).toEqual([{ network: "GitHub", url: "https://github.com/a" }]);
    expect(p.work[0]).toEqual({ name: "Acme", endDate: "2021-02", highlights: ["ok"] });
  });

  it("lo que produce leerPerfil sobrevive intacto a la sanitización", () => {
    const { perfil } = leerPerfil(CV_ES);
    expect(sanitizarPerfilJson(JSON.parse(JSON.stringify(perfil)))).toEqual(perfil);
  });
});
