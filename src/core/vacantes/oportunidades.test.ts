import { describe, expect, it } from "vitest";
import { analizar } from "../analisis/analizador";
import { detectarAlertas } from "../radar/radar";
import { RESPUESTAS_VACIAS } from "../perfil/respuestas";
import { puntuar, respuestasParaPuntuar } from "./busqueda";
import { oportunidades } from "./oportunidades";
import { crearVacante, type Vacante } from "./vacante";

const AHORA = new Date("2026-10-01T12:00:00Z");

const CV = `Java Software Engineer
Software Engineer | vmDev | Jun 2024 – Present
- Build REST APIs with Java 21 and Spring Boot on PostgreSQL, with Docker and GitHub Actions CI/CD.
- Event-driven workflows with Kafka.
Customer Service Supervisor (team of up to 12) | Telvista | 2021 – 2024
- 12 years leading bilingual, customer-facing operations teams.
- Coordinated processes and incident follow-up, and reported results to non-technical stakeholders.`;

function v(id: string, titulo: string, descripcion: string, extra: Partial<Vacante> = {}): Vacante {
  const r = crearVacante(extra.fuente ?? "greenhouse", { idExterno: id, titulo, empresa: extra.empresa ?? "Acme", url: `https://ejemplo.com/${id}`, descripcion, etiquetas: extra.etiquetas, tipo: extra.tipo });
  if (!r) throw new Error("vacante inválida en la prueba");
  return r;
}

const pedido = (resto: string) =>
  `Requirements:\n- Java and Spring Boot\n- PostgreSQL\n- Docker\n${resto}\nWe value communication, teamwork and problem solving.`;

describe("habilidades blandas con evidencia en el CV", () => {
  it("liderar equipos, reportar a stakeholders y dar seguimiento a incidentes cuentan, aunque no use la palabra", () => {
    const r = analizar(CV, pedido("- Leadership"));
    const estado = (label: string) => r.hallazgos.find((h) => h.label === label)?.estado;
    expect(estado("Comunicación")).toBe("cubierta");
    expect(estado("Trabajo en equipo")).toBe("cubierta");
    expect(estado("Resolución de problemas")).toBe("cubierta");
    expect(estado("Liderazgo")).toBe("cubierta");
  });

  it("sin evidencia siguen faltando: no se regalan", () => {
    const r = analizar("Java developer. Spring Boot, PostgreSQL, Docker.", pedido(""));
    expect(r.hallazgos.find((h) => h.label === "Comunicación")?.estado).toBe("faltante");
  });
});

describe("rango salarial al ordenar vacantes", () => {
  const sinSueldo = pedido("- Microservices") + "\n".repeat(2) + "Join our team building payments software for Latin America. ".repeat(4);

  it("el análisis manual sigue avisando que no hay rango", () => {
    expect(detectarAlertas(sinSueldo, AHORA).alertas.map((a) => a.id)).toContain("sin-rango-salarial");
  });

  it("al ordenar no resta: casi ninguna oferta internacional publica salario", () => {
    const p = puntuar(v("1", "Backend Engineer", sinSueldo), CV, RESPUESTAS_VACIAS, AHORA);
    expect(p.prioridad.factores.join(" ")).not.toMatch(/precauci/);
    expect(p.resumen.riesgo).toBe("limpia");
  });
});

describe("qué te subiría el puntaje", () => {
  const vacantes = [
    v("a", "Backend Engineer", pedido("- Microservices architecture\n- Kubernetes"), { empresa: "Uno" }),
    v("b", "Java Developer", pedido("- Microservices\n- UX/UI sensibility"), { empresa: "Dos" }),
    v("c", "Platform Engineer", pedido("- Kubernetes"), { empresa: "Tres" }),
    v("d", "Freelance", pedido("- Figma"), { fuente: "freelancer", tipo: "proyecto", etiquetas: ["Figma"] }),
  ].map((x) => puntuar(x, CV, RESPUESTAS_VACIAS, AHORA));
  const lista = oportunidades(vacantes, CV, RESPUESTAS_VACIAS, AHORA);

  it("cuenta en cuántas vacantes de empleo falta cada habilidad y cuánto subirían", () => {
    const micro = lista.find((o) => o.label === "Microservicios");
    expect(micro).toMatchObject({ vacantes: 2, blanda: false, recurso: { url: "https://spring.io/microservices" } });
    expect(micro?.puntos).toBeGreaterThan(0);
    expect(micro?.ejemplos).toEqual(["Backend Engineer — Uno", "Java Developer — Dos"]);
    expect(lista.find((o) => o.label === "Kubernetes")?.vacantes).toBe(2);
  });

  it("los proyectos freelance no cuentan y lo que ya tienes no aparece", () => {
    expect(lista.find((o) => o.label === "Figma")).toBeUndefined();
    for (const ya of ["Java", "Spring", "PostgreSQL", "Docker", "Comunicación"]) expect(lista.find((o) => o.label === ya), ya).toBeUndefined();
  });

  it("agregarla de verdad sube el puntaje", () => {
    const antes = vacantes[0].prioridad.valor ?? 0;
    const despues = puntuar(vacantes[0].vacante, `${CV}\nMicroservices`, RESPUESTAS_VACIAS, AHORA).prioridad.valor ?? 0;
    expect(despues).toBeGreaterThan(antes);
  });
});

describe("país para ordenar", () => {
  it("si no declaraste países, se usa el de tu CV; lo declarado manda", () => {
    expect(respuestasParaPuntuar(RESPUESTAS_VACIAS, "MX").paisesAutorizado).toEqual(["MX"]);
    expect(respuestasParaPuntuar({ ...RESPUESTAS_VACIAS, paisesAutorizado: ["US"] }, "MX").paisesAutorizado).toEqual(["US"]);
    expect(respuestasParaPuntuar(RESPUESTAS_VACIAS, undefined)).toBe(RESPUESTAS_VACIAS);
  });

  it("una vacante presencial en Seattle baja para quien vive en México", () => {
    const enSeattle = crearVacante("greenhouse", { idExterno: "s", titulo: "Backend Engineer", empresa: "Acme", url: "https://ejemplo.com/s", descripcion: pedido(""), paises: ["US"] });
    if (!enSeattle) throw new Error("vacante inválida");
    const p = puntuar(enSeattle, CV, respuestasParaPuntuar(RESPUESTAS_VACIAS, "MX"), AHORA);
    expect(p.prioridad.factores.join(" ")).toMatch(/Pide residir en US \(−25\)/);
  });
});
