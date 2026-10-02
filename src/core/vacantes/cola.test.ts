import { describe, expect, it } from "vitest";
import { RESPUESTAS_VACIAS } from "../perfil/respuestas";
import { crear, marcarPostulada, SELLO_ITEMS } from "../seguimiento/seguimiento";
import { puntuar, type VacantePuntuada } from "./busqueda";
import { armarCola, enviadasHoy, motivoPrincipal } from "./cola";
import { crearVacante, type FuenteId } from "./vacante";

const HOY = new Date(2026, 8, 28, 12, 0, 0);
const CV = "Backend con Node.js, PostgreSQL y Docker.";

function vp(id: string, fuente: FuenteId, descripcion = "Requisitos: Node.js, PostgreSQL y Docker."): VacantePuntuada {
  const v = crearVacante(fuente, { idExterno: id, titulo: `Backend ${id}`, empresa: "Acme", url: `https://ejemplo.com/${id}`, descripcion });
  if (!v) throw new Error("vacante inválida");
  return puntuar(v, CV, RESPUESTAS_VACIAS, HOY);
}

describe("cola diaria", () => {
  it("respeta la meta del día y descuenta lo ya enviado hoy", () => {
    let tracker = crear([], { empresa: "X", puesto: "Y" }, HOY, "p1");
    tracker = marcarPostulada(tracker, "p1", [...SELLO_ITEMS], HOY);
    const vacantes = ["1", "2", "3", "4"].map((i) => vp(i, "remotive"));
    const cola = armarCola(vacantes, tracker, { metaDiaria: 3, metaFreelance: 0, topePorFuente: 10 }, HOY);
    expect(enviadasHoy(tracker, HOY)).toBe(1);
    expect(cola.faltanHoy).toBe(2);
    expect(cola.items).toHaveLength(2);
  });

  it("no pasa del tope por plataforma y reparte entre fuentes", () => {
    const vacantes = [vp("a", "remotive"), vp("b", "remotive"), vp("c", "remotive"), vp("d", "getonboard")];
    const cola = armarCola(vacantes, [], { metaDiaria: 10, metaFreelance: 0, topePorFuente: 2 }, HOY);
    expect(cola.items.map((x) => x.vacante.fuente).sort()).toEqual(["getonboard", "remotive", "remotive"]);
  });

  it("reparte el día entre empleos y propuestas freelance, cada uno con su meta", () => {
    const proyecto = (id: string) => {
      const v = crearVacante("freelancer", {
        idExterno: id,
        titulo: `API ${id}`,
        empresa: "Cliente",
        url: `https://www.freelancer.com/projects/nodejs/${id}`,
        descripcion: "Node.js REST API con PostgreSQL y Docker.",
        tipo: "proyecto",
      });
      if (!v) throw new Error("proyecto inválido");
      return puntuar(v, CV, RESPUESTAS_VACIAS, HOY);
    };
    const empleos = Array.from({ length: 12 }, (_, i) => vp(`e${i}`, i % 2 ? "remotive" : "getonboard"));
    const proyectos = Array.from({ length: 5 }, (_, i) => proyecto(`p${i}`));
    const ajustes = { metaDiaria: 9, metaFreelance: 3, topePorFuente: 10 };

    const cola = armarCola([...empleos, ...proyectos], [], ajustes, HOY);
    expect(cola.items.filter((v) => v.vacante.tipo === "proyecto")).toHaveLength(3);
    expect(cola.items.filter((v) => v.vacante.tipo !== "proyecto")).toHaveLength(9);
    expect(cola.faltanHoy).toBe(12);

    // Lo enviado hoy se descuenta de su propia meta: una propuesta en Freelancer.com no cuenta como empleo.
    let tracker = crear([], { empresa: "Cliente", puesto: "API", url: "https://www.freelancer.com/projects/nodejs/x" }, HOY, "f1");
    tracker = marcarPostulada(tracker, "f1", [...SELLO_ITEMS], HOY);
    tracker = crear(tracker, { empresa: "Acme", puesto: "Backend", url: "https://jobs.lever.co/acme/1" }, HOY, "e1");
    tracker = marcarPostulada(tracker, "e1", [...SELLO_ITEMS], HOY);
    const despues = armarCola([...empleos, ...proyectos], tracker, ajustes, HOY);
    expect(despues.empleos).toEqual({ enviadas: 1, meta: 9 });
    expect(despues.freelance).toEqual({ enviadas: 1, meta: 3 });
    expect(despues.items.filter((v) => v.vacante.tipo === "proyecto")).toHaveLength(2);
    expect(despues.items.filter((v) => v.vacante.tipo !== "proyecto")).toHaveLength(8);
  });

  it("deja fuera las que conviene descartar (fraudes, afinidad muy baja)", () => {
    const fraude = vp("f", "remotive", "Node.js. Requiere inversión inicial de $2,000 para tu kit. Envía tu CURP y tu INE por WhatsApp. Solo comisiones.");
    expect(fraude.prioridad.recomendacion).toBe("descartar");
    expect(armarCola([fraude, vp("ok", "remotive")], [], { metaDiaria: 10, metaFreelance: 0, topePorFuente: 10 }, HOY).items.map((x) => x.vacante.idExterno)).toEqual(["ok"]);
  });

  it("explica en una línea por qué encaja", () => {
    // Kubernetes no cuenta como faltante: el CV tiene Docker, de la misma familia (transferible).
    expect(motivoPrincipal(vp("m", "remotive", "Requisitos: Node.js, PostgreSQL y Kubernetes."))).toBe("Cubres 2 de 3 requisitos.");
    expect(motivoPrincipal(vp("n", "remotive", "Requisitos: Node.js, PostgreSQL y Scrum."))).toBe("Cubres 2 de 3 requisitos; te falta Agile / Scrum.");
  });
});
