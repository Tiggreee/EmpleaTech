import { describe, expect, it } from "vitest";
import type { PerfilJson } from "../perfil/estructurado";
import { LIMITES, PLATAFORMAS, perfilFreelance, sanitizarSeguimiento } from "./freelance";

// Perfil ficticio escrito en inglés, como el de muchos desarrolladores de LatAm.
const PERFIL: PerfilJson = {
  basics: {
    name: "Laura Méndez",
    label: "Senior Java Software Engineer",
    email: "laura@ejemplo.dev",
    phone: "+52 55 0000 0000",
    summary: "Backend engineer focused on reliable payment systems. I design and build the services that move money for online stores, and I work closely with product teams to ship them on time.",
    profiles: [{ network: "GitHub", url: "https://github.com/laura-ejemplo" }],
  },
  work: [
    {
      name: "Acme",
      position: "Software Engineer",
      highlights: [
        "Built a Spring Boot API that handles 2M requests a day for the checkout team.",
        "Cut deployment time by 40% with Docker and a new release process.",
        "Mentored three junior developers and led the weekly code reviews.",
      ],
    },
  ],
  education: [],
  skills: [
    { name: "Backend", keywords: ["Java", "Spring Boot", "PostgreSQL"] },
    { name: "Frontend", keywords: ["React", "TypeScript", "java"] },
  ],
  languages: [],
  certificates: [{ name: "Oracle Cloud Infrastructure Architect Associate" }],
  projects: [
    { name: "Payments Gateway", description: "Spring Boot microservice", url: "https://github.com/laura-ejemplo/payments" },
    { name: "Private Notes" },
  ],
};

describe("perfil freelance", () => {
  it("en inglés: resumen, stack, logros, proyectos con enlace y certificaciones, sin correo ni teléfono", () => {
    const pf = perfilFreelance(PERFIL, "en");
    // Con cuatro habilidades pasaría de 70 caracteres: se queda con las que caben.
    expect(pf.titular).toBe("Senior Java Software Engineer | Java · Spring Boot · PostgreSQL");
    expect(pf.titular.length).toBeLessThanOrEqual(LIMITES.titular);
    expect(pf.descripcion).toMatch(/^Backend engineer focused on reliable payment systems\. .*\n\nMain stack: Java, Spring Boot, PostgreSQL, React, TypeScript\./);
    expect(pf.descripcion).toContain("- Built a Spring Boot API that handles 2M requests a day for the checkout team.");
    expect(pf.descripcion).toContain("- Payments Gateway: https://github.com/laura-ejemplo/payments");
    expect(pf.descripcion).not.toContain("Private Notes");
    expect(pf.descripcion).toContain("Oracle Cloud Infrastructure Architect Associate");
    expect(pf.descripcion).not.toMatch(/laura@ejemplo|\+52/);
    // Sin duplicados («Java» y «java») y en el orden del CV.
    expect(pf.habilidades).toEqual(["Java", "Spring Boot", "PostgreSQL", "React", "TypeScript"]);
    expect(pf.gig.titulo).toBe("I will build Java and Spring Boot applications");
  });

  it("en español con un CV en inglés: no pega frases en inglés, arma la presentación con tu título y stack", () => {
    const pf = perfilFreelance(PERFIL, "es");
    expect(pf.descripcion).toMatch(/^Soy Senior Java Software Engineer y trabajo con Java, Spring Boot, PostgreSQL, React y TypeScript\./);
    expect(pf.descripcion).not.toContain("Built a Spring Boot API");
    expect(pf.descripcion).not.toContain("payment systems");
    expect(pf.descripcion).toContain("Proyectos:\n- Payments Gateway: https://github.com/laura-ejemplo/payments");
    expect(pf.gig.titulo).toBe("Desarrollaré aplicaciones con Java y Spring Boot");
  });

  it("respeta los límites de las plataformas aunque el perfil sea enorme", () => {
    const enorme: PerfilJson = { ...PERFIL, basics: { ...PERFIL.basics, label: "Principal Distributed Systems and Cloud Platform Engineering Consultant", summary: "x ".repeat(2000) } };
    const pf = perfilFreelance(enorme, "en");
    expect(pf.titular.length).toBeLessThanOrEqual(LIMITES.titular);
    expect(pf.descripcion.length).toBeLessThanOrEqual(LIMITES.descripcion);
    expect(pf.gig.descripcion.length).toBeLessThanOrEqual(LIMITES.descripcionGig);
  });
});

describe("seguimiento de registro", () => {
  it("toda plataforma empieza pendiente y se ignoran estados o plataformas desconocidas", () => {
    const s = sanitizarSeguimiento({ workana: "registrado", upwork: "hackeado", otra: "registrado" });
    expect(Object.keys(s)).toEqual(PLATAFORMAS.map((p) => p.id));
    expect(s.workana).toBe("registrado");
    expect(s.upwork).toBe("pendiente");
    expect(sanitizarSeguimiento(null).fiverr).toBe("pendiente");
  });
});
