import { describe, expect, it } from "vitest";
import type { Consulta, ContextoFuente } from "@/core/vacantes/fuentes";
import { braintrust, freelancer, mapearBraintrust, mapearFreelancer } from "./freelance";

// Respuestas sintéticas con la misma forma que las APIs reales (revisada en vivo el 2026-09-29).

const proyectoFreelancer = (p: Record<string, unknown> = {}) => ({
  id: 40738944,
  title: "Android GPS Tracker App",
  seo_url: "android/Android-GPS-Tracker-App",
  currency: { code: "INR", exchange_rate: 0.0104 },
  description: "Need a Java developer for an Android app with geofencing.",
  jobs: [{ name: "Java" }, { name: "Android" }],
  type: "fixed",
  budget: { minimum: 12500, maximum: 37500 },
  bid_stats: { bid_count: 110 },
  time_submitted: 1790628032,
  location: { country: {} },
  local: false,
  ...p,
});

describe("Freelancer.com", () => {
  it("proyecto remoto con presupuesto en su moneda, habilidades y propuestas", () => {
    const [v] = mapearFreelancer({ result: { projects: [proyectoFreelancer()] } });
    expect(v).toMatchObject({
      id: "freelancer:40738944",
      tipo: "proyecto",
      empresa: "Cliente de Freelancer.com",
      modalidad: "remoto",
      paises: [],
      url: "https://www.freelancer.com/projects/android/Android-GPS-Tracker-App",
      salario: { min: 12500, max: 37500, moneda: "INR", periodo: "proyecto" },
      etiquetas: ["Java", "Android"],
      propuestas: 110,
    });
  });

  it("omite presupuestos que no compensan la propuesta (menos de US$100 o US$10/h)", () => {
    const vs = mapearFreelancer({
      result: {
        projects: [
          proyectoFreelancer({ id: 1, budget: { minimum: 1500, maximum: 8000 } }), // ≈ US$83
          proyectoFreelancer({ id: 2, type: "hourly", budget: { minimum: 5, maximum: 8 }, currency: { code: "USD", exchange_rate: 1 } }),
          proyectoFreelancer({ id: 3, type: "hourly", budget: { minimum: 15, maximum: 25 }, currency: { code: "USD", exchange_rate: 1 } }),
          proyectoFreelancer({ id: 4, budget: { minimum: 30 }, currency: { code: "EUR", exchange_rate: 1.08 } }), // sin máximo: US$32
        ],
      },
    });
    expect(vs.map((v) => v.idExterno)).toEqual(["3"]);
    expect(vs[0].salario).toMatchObject({ periodo: "hora", moneda: "USD" });
  });

  it("proyectos locales llevan el país del cliente; los privados o borrados se ignoran", () => {
    const vs = mapearFreelancer({
      result: {
        projects: [
          proyectoFreelancer({ id: 5, local: true, location: { country: { name: "Mexico" } } }),
          proyectoFreelancer({ id: 6, nonpublic: true }),
          proyectoFreelancer({ id: 7, deleted: true }),
        ],
      },
    });
    expect(vs).toHaveLength(1);
    expect(vs[0]).toMatchObject({ empresa: "Cliente en Mexico", modalidad: "presencial", paises: ["MX"] });
  });

  it("busca por la palabra clave de cada búsqueda, en inglés y español", async () => {
    const urls: string[] = [];
    const ctx: ContextoFuente = { http: { json: async (url) => (urls.push(url), { result: { projects: [] } }) }, claves: {}, ahora: new Date() };
    const consulta: Consulta = { palabras: ["senior java software engineer", "java backend"], soloRemoto: true, paises: [], empresas: {}, maxPorFuente: 50 };
    await freelancer.buscar(consulta, ctx);
    expect(urls).toHaveLength(1);
    const u = new URL(urls[0]);
    expect(u.searchParams.get("query")).toBe("java");
    expect(u.searchParams.getAll("languages[]")).toEqual(["en", "es"]);
  });
});

const trabajoBraintrust = (p: Record<string, unknown> = {}) => ({
  id: 17921,
  title: "Senior Java Engineer (LATAM - Remote)",
  employer: { name: "Acme Cloud" },
  budget_minimum_usd: "70.00",
  budget_maximum_usd: "74.00",
  payment_type: "hourly",
  main_skills: [{ name: "Java" }, { name: "Spring Boot" }],
  role: { name: "Engineering" },
  created: "2026-09-28T23:12:02.119695Z",
  locations: [{ location: "South America" }],
  job_type: "freelance",
  ...p,
});

describe("Braintrust", () => {
  it("proyecto con tarifa por hora en USD, región y descripción del detalle", () => {
    const v = mapearBraintrust(trabajoBraintrust(), { introduction: "", description: "<p>Construir APIs con <b>Spring Boot</b>.</p>", requirements: "" });
    expect(v).toMatchObject({
      id: "braintrust:17921",
      tipo: "proyecto",
      empresa: "Acme Cloud",
      modalidad: "remoto",
      url: "https://app.usebraintrust.com/jobs/17921/",
      salario: { min: 70, max: 74, moneda: "USD", periodo: "hora" },
      etiquetas: ["Java", "Spring Boot", "Engineering"],
      descripcion: "Construir APIs con Spring Boot.",
    });
    expect(v?.paises).toContain("MX");
  });

  it("las contrataciones directas son empleos y los ids raros se ignoran", () => {
    expect(mapearBraintrust(trabajoBraintrust({ job_type: "direct_hire" }))?.tipo).toBeUndefined();
    expect(mapearBraintrust(trabajoBraintrust({ id: "../x" }))).toBeUndefined();
  });

  it("pide el detalle solo de los que coinciden con tu búsqueda y nunca pagina con ?page=", async () => {
    const urls: string[] = [];
    const ctx: ContextoFuente = {
      http: {
        json: async (url) => {
          urls.push(url);
          if (url.endsWith("/api/jobs/?page_size=100")) return { results: [trabajoBraintrust(), trabajoBraintrust({ id: 2, title: "Marketing Designer", main_skills: [{ name: "Figma" }], role: { name: "Design" } })] };
          return { description: "<p>Detalle</p>" };
        },
      },
      claves: {},
      ahora: new Date(),
    };
    const vs = await braintrust.buscar({ palabras: ["java developer"], soloRemoto: true, paises: [], empresas: {}, maxPorFuente: 50 }, ctx);
    expect(vs.map((v) => v.idExterno)).toEqual(["17921"]);
    expect(urls).toEqual(["https://app.usebraintrust.com/api/jobs/?page_size=100", "https://app.usebraintrust.com/api/jobs/17921/"]);
    expect(urls.some((u) => /[?&]page=/.test(u))).toBe(false);
  });
});
