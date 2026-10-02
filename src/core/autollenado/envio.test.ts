import { describe, expect, it } from "vitest";
import { puestoYEmpresa } from "./envio";

describe("puesto y empresa de una postulación fuera de tu búsqueda", () => {
  it("usa la empresa de la dirección para saber qué parte del título es cuál", () => {
    const url = "https://jobs.lever.co/acme-pagos/0f1e2d3c";
    expect(puestoYEmpresa(url, "Senior Backend Developer - Acme Pagos")).toEqual({ puesto: "Senior Backend Developer", empresa: "Acme Pagos" });
    expect(puestoYEmpresa(url, "Acme Pagos - Senior Backend Developer")).toEqual({ puesto: "Senior Backend Developer", empresa: "Acme Pagos" });
  });

  it("entiende los títulos de Greenhouse y Ashby", () => {
    expect(puestoYEmpresa("https://job-boards.greenhouse.io/nodo/jobs/1", "Job Application for Backend Engineer at Nodo Pagos")).toEqual({
      puesto: "Backend Engineer",
      empresa: "Nodo Pagos",
    });
    expect(puestoYEmpresa("https://jobs.ashbyhq.com/acme/123", "Backend Engineer @ Acme")).toEqual({ puesto: "Backend Engineer", empresa: "Acme" });
  });

  it("sin separador, la empresa sale de la dirección; fuera de los ATS, del dominio", () => {
    expect(puestoYEmpresa("https://jobs.lever.co/acme-pagos/1", "Backend Developer")).toEqual({ puesto: "Backend Developer", empresa: "Acme Pagos" });
    expect(puestoYEmpresa("https://www.freelancer.com/projects/x", "Payments API for an online store")).toEqual({
      puesto: "Payments API for an online store",
      empresa: "freelancer.com",
    });
  });

  it("nunca deja el puesto vacío", () => {
    expect(puestoYEmpresa("no es url", "")).toEqual({ puesto: "Postulación", empresa: "Empresa" });
  });
});
