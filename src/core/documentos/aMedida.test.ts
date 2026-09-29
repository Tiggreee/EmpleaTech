import { describe, expect, it } from "vitest";
import { leerPerfil } from "../perfil/estructurado";
import { sanitizarRespuestas } from "../perfil/respuestas";
import { MAX_PROPUESTA, aniosDeExperiencia, prepararDocumentos } from "./aMedida";
import { cvATexto, fechaLegible, rangoFechas } from "./formato";

const AHORA = new Date("2026-09-28T12:00:00Z");

const CV = `Ana Torres
Desarrolladora Backend
Guadalajara, México | ana@correo.mx | +52 33 1234 5678

Experiencia
Desarrolladora Backend — Acme Pagos
Ene 2021 – Presente
- Organicé el onboarding del equipo y la documentación interna.
- Diseñé la API de cobros en Node.js con PostgreSQL que procesa 2M de transacciones al mes.
- Migré reportes a Python con pandas.

Programadora — Globant
03/2018 - 12/2021
- Mantuve aplicaciones en Java.

Habilidades
Java, Python, Node.js, PostgreSQL, Scrum`;

const OFERTA_ES = {
  titulo: "Desarrolladora Backend Node.js",
  empresa: "Nodo Pagos",
  texto: "Requisitos:\n- Experiencia con Node.js y PostgreSQL.\n- Kubernetes.\n- APIs REST para pagos.\nDeseable: Python.",
};

const OFERTA_EN = {
  titulo: "Backend Engineer",
  empresa: "Stripe",
  texto: "We are looking for a backend engineer with strong Node.js and PostgreSQL experience to build our payments platform. You will work with our team on APIs.",
};

describe("documentos a la medida", () => {
  const { perfil } = leerPerfil(CV);
  const r = sanitizarRespuestas({ disponibilidad: "2-semanas", aniosExperiencia: 8 });

  it("no inventa nada: los logros y habilidades salen del perfil", () => {
    const d = prepararDocumentos(perfil, OFERTA_ES, r, AHORA);
    const logrosOriginales = new Set(perfil.work.flatMap((w) => w.highlights));
    for (const h of d.cv.work.flatMap((w) => w.highlights)) expect(logrosOriginales.has(h)).toBe(true);
    const habilidadesOriginales = new Set(perfil.skills.flatMap((s) => s.keywords));
    for (const k of d.cv.skills.flatMap((s) => s.keywords)) expect(habilidadesOriginales.has(k)).toBe(true);
    expect(d.cv.work.map((w) => w.name)).toEqual(perfil.work.map((w) => w.name));
    expect(d.carta).not.toMatch(/Kubernetes/);
  });

  it("pone arriba el logro más relacionado con la vacante y marca las brechas", () => {
    const d = prepararDocumentos(perfil, OFERTA_ES, r, AHORA);
    expect(d.cv.work[0].highlights[0]).toMatch(/API de cobros en Node\.js/);
    expect(d.enfasis).toEqual(expect.arrayContaining(["Node.js", "PostgreSQL"]));
    expect(d.brechas).toContain("Kubernetes");
    expect(d.cv.basics.summary).toMatch(/^Desarrolladora Backend con 8 años de experiencia en .*Node\.js/);
  });

  it("carta en español con empresa, puesto, evidencia real y disponibilidad", () => {
    const d = prepararDocumentos(perfil, OFERTA_ES, r, AHORA);
    expect(d.idioma).toBe("es");
    expect(d.carta).toMatch(/^Hola, equipo de Nodo Pagos:/);
    expect(d.carta).toContain("vacante de Desarrolladora Backend Node.js");
    expect(d.carta).toContain("En Acme Pagos, diseñé la API de cobros");
    expect(d.carta).toContain("Puedo empezar en dos semanas.");
    expect(d.carta).toMatch(/Ana Torres\nana@correo\.mx · \+52 33 1234 5678$/);
  });

  it("vacante en inglés: documentos en inglés y sin pegar frases del CV en español", () => {
    const d = prepararDocumentos(perfil, OFERTA_EN, r, AHORA);
    expect(d.idioma).toBe("en");
    expect(d.carta).toMatch(/^Hi Stripe team,/);
    expect(d.carta).toContain("I can start in two weeks.");
    expect(d.carta).not.toMatch(/Diseñé|cobros/);
    expect(d.cv.basics.summary).toMatch(/with 8 years of experience in/);
  });

  it("años de experiencia sin contar dos veces los puestos que se traslapan", () => {
    expect(aniosDeExperiencia(perfil, sanitizarRespuestas({}), AHORA)).toBe(8);
    expect(aniosDeExperiencia(perfil, sanitizarRespuestas({ aniosExperiencia: 5 }), AHORA)).toBe(5);
  });

  it("si no declaraste tus años, ningún documento los afirma (sumar puestos de otras áreas sería falso)", () => {
    const d = prepararDocumentos(perfil, OFERTA_ES, sanitizarRespuestas({}), AHORA);
    for (const texto of [d.cv.basics.summary ?? "", d.carta, d.propuesta]) expect(texto).not.toMatch(/\d+ años?/);
  });
});

describe("propuesta para proyectos freelance", () => {
  const { perfil: base } = leerPerfil(CV);
  const perfil = {
    ...base,
    basics: { ...base.basics, url: "https://ana.dev", profiles: [{ network: "GitHub", url: "https://github.com/ana-ejemplo" }] },
    projects: [
      { name: "Pasarela de cobros", description: "API de pagos en Node.js con PostgreSQL y webhooks", url: "https://github.com/ana-ejemplo/cobros" },
      { name: "Recetario", description: "App de recetas en Flutter" },
    ],
  };
  const r = sanitizarRespuestas({ disponibilidad: "inmediata" });
  const PROYECTO = { titulo: "API de pagos para tienda en línea", empresa: "Cliente en México", texto: "Necesito una API en Node.js con PostgreSQL para cobrar con tarjeta y enviar webhooks.", tipo: "proyecto" as const };

  it("abre con el proyecto del cliente, muestra evidencia real y un proyecto propio con su enlace", () => {
    const d = prepararDocumentos(perfil, PROYECTO, r, AHORA);
    expect(d.propuesta).toMatch(/^Hola, leí tu proyecto «API de pagos para tienda en línea»/);
    expect(d.propuesta).toContain("Node.js");
    expect(d.propuesta).toContain("en Acme Pagos diseñé la API de cobros");
    expect(d.propuesta).toContain("Pasarela de cobros");
    expect(d.propuesta).toContain("https://github.com/ana-ejemplo/cobros");
    expect(d.propuesta).not.toContain("Recetario");
    expect(d.propuesta).toContain("Puedo empezar de inmediato.");
    expect(d.propuesta).toMatch(/\?/);
  });

  it("nunca incluye correo ni teléfono (las plataformas lo prohíben antes del contrato), pero sí tu portafolio", () => {
    const d = prepararDocumentos(perfil, PROYECTO, r, AHORA);
    expect(d.propuesta).not.toContain("ana@correo.mx");
    expect(d.propuesta).not.toMatch(/\+52/);
    expect(d.propuesta).toMatch(/Ana Torres\nhttps:\/\/github\.com\/ana-ejemplo · https:\/\/ana\.dev$/);
  });

  it("en inglés si el proyecto está en inglés, sin pegar frases del CV en español", () => {
    const d = prepararDocumentos(perfil, { ...PROYECTO, titulo: "Payments API", texto: "We are looking for a developer to build a Node.js API with PostgreSQL that charges cards and sends webhooks to our online store. You will work with our team." }, r, AHORA);
    expect(d.propuesta).toMatch(/^Hi, I read your project "Payments API"/);
    expect(d.propuesta).not.toMatch(/diseñé|cobros de/i);
    expect(d.propuesta).toContain("I can start immediately.");
  });

  it("cabe en el límite de Freelancer.com aunque el perfil sea largo", () => {
    const largo = { ...perfil, projects: [{ name: "Pasarela de cobros", description: `API de pagos en Node.js con PostgreSQL. ${"Detalle técnico extenso. ".repeat(80)}`, url: "https://github.com/ana-ejemplo/cobros" }] };
    const d = prepararDocumentos(largo, PROYECTO, r, AHORA);
    expect(d.propuesta.length).toBeLessThanOrEqual(MAX_PROPUESTA);
    expect(d.propuesta).toMatch(/Ana Torres/);
  });
});

describe("formato", () => {
  it("fechas en el idioma del documento", () => {
    expect(fechaLegible("2021-01", "es")).toBe("ene 2021");
    expect(fechaLegible("2021-01", "en")).toBe("Jan 2021");
    expect(rangoFechas("2021-01", undefined, "en")).toBe("Jan 2021 – Present");
    expect(rangoFechas("2018", "2021", "es")).toBe("2018 – 2021");
  });

  it("CV en texto plano con secciones", () => {
    const { perfil } = leerPerfil(CV);
    const t = cvATexto(perfil, "es");
    expect(t).toMatch(/^Ana Torres\nDesarrolladora Backend\nana@correo\.mx/);
    expect(t).toContain("EXPERIENCIA\nDesarrolladora Backend — Acme Pagos\nene 2021 – actual");
    expect(t).toContain("HABILIDADES");
  });
});
