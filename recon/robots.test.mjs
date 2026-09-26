import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseRobots, permitido } from "./robots.mjs";

const fx = (n) => parseRobots(readFileSync(new URL(`./fixtures/${n}.robots.txt`, import.meta.url), "utf8"));
const UA = "EmpleaTechRecon/0.1";

describe("parser robots.txt con robots reales (fixtures)", () => {
  it("jobright: /legal/* estÃ¡ prohibido (el recon anterior sÃ­ lo descargÃ³)", () => {
    const g = fx("jobright.ai");
    expect(permitido(g, UA, "/legal/service")).toBe(false);
    expect(permitido(g, UA, "/")).toBe(true);
    expect(permitido(g, UA, "/assistant")).toBe(true);
    expect(permitido(g, UA, "/jobs/recommend/abc")).toBe(false);
    expect(permitido(g, UA, "/api/events")).toBe(false);
  });

  it("jobright: el grupo especÃ­fico de CrawlerA restringe /jobs/", () => {
    const g = fx("jobright.ai");
    expect(permitido(g, "CrawlerA/1.0", "/jobs/explore")).toBe(false);
    expect(permitido(g, "CrawlerA/1.0", "/about")).toBe(true);
  });

  it("simplify: rutas privadas prohibidas, home permitida", () => {
    const g = fx("simplify.jobs");
    expect(permitido(g, UA, "/dashboard")).toBe(false);
    expect(permitido(g, UA, "/tracker")).toBe(false);
    expect(permitido(g, UA, "/")).toBe(true);
    expect(permitido(g, UA, "/helper")).toBe(true);
  });

  it("torre: '$' y comodines; /api/ prohibido; lo no listado se permite", () => {
    const g = fx("torre.ai");
    expect(permitido(g, UA, "/")).toBe(true);
    expect(permitido(g, UA, "/api/genome")).toBe(false);
    expect(permitido(g, UA, "/search/people?q=a")).toBe(false);
    expect(permitido(g, UA, "/es/search/jobs")).toBe(true);
    expect(permitido(g, UA, "/headhunt")).toBe(true);
    expect(permitido(g, "barkrowler", "/")).toBe(false);
  });

  it("gana la regla mÃ¡s larga y Allow gana empates", () => {
    const g = parseRobots("User-agent: *\nDisallow: /a\nAllow: /a/b\nDisallow: /c\nAllow: /c");
    expect(permitido(g, UA, "/a/x")).toBe(false);
    expect(permitido(g, UA, "/a/b/x")).toBe(true);
    expect(permitido(g, UA, "/c")).toBe(true);
  });

  it("sin grupo aplicable o robots vacÃ­o => permitido", () => {
    expect(permitido(parseRobots(""), UA, "/x")).toBe(true);
    expect(permitido(parseRobots("User-agent: otro\nDisallow: /"), UA, "/x")).toBe(true);
  });

  it("varios User-agent seguidos comparten reglas", () => {
    const g = parseRobots("User-agent: a\nUser-agent: b\nDisallow: /x");
    expect(permitido(g, "a", "/x")).toBe(false);
    expect(permitido(g, "b", "/x")).toBe(false);
    expect(permitido(g, "c", "/x")).toBe(true);
  });
});

