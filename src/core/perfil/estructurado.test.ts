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

describe("leerPerfil: formato de PDF sin viñetas de texto (visto en un CV real)", () => {
  const CV = `Senior Java Software Engineer | Full-Stack Java & React
LAURA MÉNDEZ RÍOS
Puebla, Mexico (Remote / Hybrid) | laura@ejemplo.dev | +52 2221234567
linkedin.com/in/laura-mendez | github.com/lauramendez

PROFESSIONAL EXPERIENCE
Independent Software Projects | June 2024 - Present
Design and build full-stack applications with Java/Spring Boot REST APIs and React front ends backed by PostgreSQL and
Redis, owning testing and deployment.
Implement event-driven workflows with Spring Kafka.
Support Lead | Customer Operations | June 2015 - June 2024
Led bilingual teams for 9 years, owning processes and incident coordination.

PROJECTS
StockApp | Inventory Platform | Public
Value: Event-driven inventory platform built for consistent stock allocation, reliable event
handling, and observability.
Repository: github.com/lauramendez/stockapp
Stack: Java 21, Spring Boot 3.4, PostgreSQL, React 19
Engineering Outcome: Keeps a zero-oversell invariant under concurrency.
PortfolioWeb | Contact API | Public
Value: Portfolio with rate limiting.
Repository: github.com/lauramendez/portfolio

EDUCATION
Full Stack Developer Program | TripleTen LatAm | June 2025 - June 2026
B.A. in International Business | Universidad del Valle | June 2009 - May 2013

TECHNICAL SKILLS
Data: SQL (PostgreSQL, Oracle SQL/PL-SQL, H2), Redis

CERTIFICATIONS
Oracle Cloud Infrastructure Certified Architect Associate | Oracle | 2026
EF SET English Certificate - C2 Proficient | EF Standard English Test | 2024`;
  const { perfil } = leerPerfil(CV);

  it("título arriba del nombre y ubicación sin la modalidad entre paréntesis", () => {
    expect(perfil.basics.name).toBe("Laura Méndez Ríos");
    expect(perfil.basics.label).toBe("Senior Java Software Engineer");
    expect(perfil.basics.location).toEqual({ city: "Puebla", countryCode: "MX" });
  });

  it("logros de varias líneas sin viñeta, y el siguiente puesto no se come la última línea", () => {
    expect(perfil.work).toHaveLength(2);
    expect(perfil.work[0].highlights).toEqual([
      "Design and build full-stack applications with Java/Spring Boot REST APIs and React front ends backed by PostgreSQL and Redis, owning testing and deployment.",
      "Implement event-driven workflows with Spring Kafka.",
    ]);
    expect(perfil.work[1]).toMatchObject({ position: "Support Lead", name: "Customer Operations", startDate: "2015-06", endDate: "2024-06" });
  });

  it("educación en una línea por entrada, con bootcamp y «B.A.»", () => {
    expect(perfil.education).toEqual([
      { studyType: "Full Stack Developer Program", institution: "TripleTen LatAm", startDate: "2025-06", endDate: "2026-06" },
      { studyType: "B.A.", area: "International Business", institution: "Universidad del Valle", startDate: "2009-06", endDate: "2013-05" },
    ]);
  });

  it("proyectos con campos etiquetados, certificaciones por columnas y habilidades de Oracle", () => {
    expect(perfil.projects).toEqual([
      { name: "StockApp", url: "https://github.com/lauramendez/stockapp", description: "Event-driven inventory platform built for consistent stock allocation, reliable event handling, and observability. Stack: Java 21, Spring Boot 3.4, PostgreSQL, React 19 Keeps a zero-oversell invariant under concurrency." },
      { name: "PortfolioWeb", url: "https://github.com/lauramendez/portfolio", description: "Portfolio with rate limiting." },
    ]);
    expect(perfil.certificates[1]).toEqual({ name: "EF SET English Certificate - C2 Proficient", issuer: "EF Standard English Test", date: "2024" });
    const todas = perfil.skills.flatMap((s) => s.keywords);
    expect(todas).toEqual(expect.arrayContaining(["Oracle Cloud (OCI)", "Oracle Database"]));
    expect(todas.some((k) => k.endsWith(")") && !k.includes("("))).toBe(false);
  });
});
