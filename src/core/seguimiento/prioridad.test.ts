import { describe, expect, it } from "vitest";
import { CV_EJEMPLO, OFERTA_EJEMPLO } from "../analisis/ejemplo";
import { accionesDeHoy, brechasFrecuentes, generarInsights } from "./panel";
import { ordenarPorPrioridad, prioridad, prioridadDeResumen } from "./prioridad";
import {
  SELLO_ITEMS,
  adjuntarOferta,
  analizarOferta,
  cambiarEstado,
  crear,
  editarNotas,
  exportarJSON,
  importarJSON,
  marcarPostulada,
  reanalizarTodas,
  sanitizar,
  type Postulacion,
} from "./seguimiento";

const T0 = new Date("2026-09-01T10:00:00Z");
const dias = (n: number) => new Date(T0.getTime() + n * 86_400_000);
const CV_FUERTE = "5 años de experiencia. Python, AWS, Kubernetes, Docker, PostgreSQL, REST APIs, Node.js, inglés avanzado, Terraform, GraphQL.";

function conOferta(id: string, empresa: string, cv: string, oferta: string, ahora = T0): Postulacion[] {
  return crear([], { empresa, puesto: "Dev", oferta: analizarOferta(cv, oferta, "cv1", ahora) }, ahora, id);
}
const unir = (...ls: Postulacion[][]) => ls.flat();

describe("oferta guardada y análisis", () => {
  it("guarda la foto del análisis y usa su score", () => {
    const [p] = conOferta("a", "Acme", CV_EJEMPLO, OFERTA_EJEMPLO);
    expect(p.oferta?.resumen.score).toBe(p.score);
    expect(p.oferta?.resumen.total).toBeGreaterThan(0);
    expect(p.oferta?.resumen.brechas).toContain("AWS");
    expect(p.oferta?.resumen.transferibles).toContain("Kubernetes");
  });

  it("recorta el texto de la oferta a 12 mil caracteres", () => {
    const [p] = conOferta("a", "Acme", CV_EJEMPLO, `Requisitos:\n- Python ${"x".repeat(20_000)}`);
    expect(p.oferta?.texto.length).toBe(12_000);
  });

  it("reanalizar con otro CV cambia el score de todas", () => {
    const l = unir(conOferta("a", "A", CV_EJEMPLO, OFERTA_EJEMPLO));
    const antes = l[0].score ?? 0;
    const despues = reanalizarTodas(l, CV_FUERTE, "cv2", dias(1));
    expect(despues[0].score).toBeGreaterThan(antes);
    expect(despues[0].oferta?.cvId).toBe("cv2");
  });

  it("adjuntar oferta a una postulación manual", () => {
    let l = crear([], { empresa: "Manual", puesto: "X" }, T0, "m");
    expect(l[0].oferta).toBeUndefined();
    l = adjuntarOferta(l, "m", analizarOferta(CV_FUERTE, OFERTA_EJEMPLO, "cv1", T0), T0);
    expect(l[0].score).toBeGreaterThan(50);
  });
});

describe("migración y saneamiento de datos", () => {
  it("datos de la v1 (sin oferta) siguen cargando", () => {
    const v1 = [{ id: "x", empresa: "Vieja", puesto: "P", estado: "guardada", creadaEn: "2026-09-01T00:00:00Z", score: 70, historial: [] }];
    const { items, descartadas } = sanitizar(v1);
    expect(descartadas).toBe(0);
    expect(items[0]).toMatchObject({ empresa: "Vieja", score: 70, oferta: undefined });
  });

  it("ida y vuelta conserva la oferta y descarta resúmenes corruptos", () => {
    const l = conOferta("a", "Acme", CV_EJEMPLO, OFERTA_EJEMPLO);
    expect(importarJSON(exportarJSON(l, T0)).items).toEqual(l);
    const roto = [{ ...l[0], oferta: { texto: "algo", resumen: "no-es-objeto" } }, { ...l[0], id: "b", oferta: { texto: "  ", resumen: {} } }];
    const s = sanitizar(roto);
    expect(s.items.map((i) => i.oferta)).toEqual([undefined, undefined]);
  });

  it("un resumen con números fuera de rango se normaliza", () => {
    const [p] = conOferta("a", "A", CV_EJEMPLO, OFERTA_EJEMPLO);
    const sucio = { ...p, oferta: { ...p.oferta, resumen: { ...p.oferta!.resumen, score: 900, cubiertas: -5, alertas: { alta: 9999, media: "x" } } } };
    const r = sanitizar([sucio]).items[0].oferta!.resumen;
    expect(r.score).toBeNull();
    expect(r.cubiertas).toBe(0);
    expect(r.alertas).toEqual({ alta: 50, media: 0, baja: 0 });
  });
});

describe("prioridad explicable", () => {
  it("sin análisis: valor null y lo dice", () => {
    const [p] = crear([], { empresa: "A", puesto: "B" }, T0, "a");
    expect(prioridad(p, T0)).toMatchObject({ valor: null, recomendacion: "sin-analisis" });
  });

  it("afinidad alta y limpia => postular", () => {
    const [p] = conOferta("a", "A", CV_FUERTE, "Requisitos:\n- Python y AWS.\n- Salario: $50,000 MXN mensuales y horario de lunes a viernes para el equipo.");
    const pr = prioridad(p, T0);
    expect(pr.recomendacion).toBe("postular");
    expect(pr.factores[0]).toMatch(/Afinidad \d+%/);
  });

  it("una señal grave hunde la prioridad y recomienda descartar, aun con afinidad perfecta", () => {
    const [p] = conOferta("a", "A", CV_FUERTE, "Requisitos:\n- Python y AWS.\nRequiere inversión inicial de $2,000 para tu kit. Salario: $50,000 MXN.");
    const pr = prioridad(p, T0);
    expect(pr.recomendacion).toBe("descartar");
    expect(pr.factores.join(" ")).toMatch(/grave/);
  });

  it("guardada hace más de 14 días descuenta vigencia", () => {
    const [p] = conOferta("a", "A", CV_FUERTE, "Requisitos:\n- Python y AWS.\nSalario: $50,000 MXN mensuales.");
    const fresca = prioridad(p, T0).valor!;
    const vieja = prioridad(p, dias(20));
    expect(vieja.valor).toBe(fresca - 5);
    expect(vieja.factores.join(" ")).toMatch(/hace 20 días/);
  });

  it("ordena por valor y deja sin análisis al final", () => {
    const l = unir(
      crear([], { empresa: "sin", puesto: "x" }, T0, "s"),
      conOferta("baja", "Baja", "Solo sé cocinar.", "Requisitos:\n- Python y AWS y Docker."),
      conOferta("alta", "Alta", CV_FUERTE, "Requisitos:\n- Python y AWS."),
    );
    expect(ordenarPorPrioridad(l, T0).map((x) => x.postulacion.id)).toEqual(["alta", "baja", "s"]);
  });
});

describe("panel: acciones de hoy, brechas e insights", () => {
  it("acciones de hoy solo incluye lo que exige acción, urgente primero", () => {
    let l = unir(crear([], { empresa: "Guardada", puesto: "g" }, T0, "g"), crear([], { empresa: "Estancada", puesto: "e" }, T0, "e"), crear([], { empresa: "Reciente", puesto: "r" }, T0, "r"));
    l = marcarPostulada(l, "e", [...SELLO_ITEMS], T0);
    l = marcarPostulada(l, "r", [...SELLO_ITEMS], dias(9));
    l = crear(l, { empresa: "Entrevista", puesto: "i" }, T0, "i");
    l = marcarPostulada(l, "i", [...SELLO_ITEMS], T0);
    l = cambiarEstado(l, "i", "entrevista", dias(2));
    const acciones = accionesDeHoy(l, dias(10));
    expect(acciones.map((a) => a.empresa)).toEqual(["Estancada", "Entrevista"]);
    expect(acciones[0].tono).toBe("urgente");
  });

  it("brechas frecuentes agrega entre ofertas", () => {
    const l = unir(conOferta("a", "A", "solo cocino y bailo todos los días", "Requisitos:\n- Python y AWS."), conOferta("b", "B", "solo cocino y bailo todos los días", "Requisitos:\n- AWS y Docker."));
    expect(brechasFrecuentes(l)[0]).toEqual({ label: "AWS", veces: 2 });
  });

  it("insights: sin CV, listas para postular y brechas repetidas", () => {
    const l = unir(
      conOferta("a", "A", CV_FUERTE, "Requisitos:\n- Python y AWS.\nSalario: $50,000 MXN mensuales."),
      conOferta("b", "B", CV_EJEMPLO, "Requisitos:\n- Python y AWS."),
      conOferta("c", "C", CV_EJEMPLO, "Requisitos:\n- AWS y Docker."),
    );
    const ids = generarInsights(l, T0, false).map((i) => i.id);
    expect(ids).toEqual(expect.arrayContaining(["sin-cv", "listas", "brechas"]));
    expect(generarInsights(l, T0, true).map((i) => i.id)).not.toContain("sin-cv");
  });

  it("insight de 8 postulaciones sin entrevista", () => {
    let l: Postulacion[] = [];
    for (let i = 0; i < 8; i++) {
      l = crear(l, { empresa: `E${i}`, puesto: "p" }, T0, `id${i}`);
      l = marcarPostulada(l, `id${i}`, [...SELLO_ITEMS], T0);
    }
    expect(generarInsights(l, dias(2), true).map((i) => i.id)).toContain("sin-entrevistas");
  });

  it("lista vacía no genera insights salvo el del CV", () => {
    expect(generarInsights([], T0, true)).toEqual([]);
    expect(generarInsights([], T0, false).map((i) => i.id)).toEqual(["sin-cv"]);
  });
});

describe("prioridadDeResumen y notas", () => {
  it("se puede evaluar un análisis recién hecho, antes de guardarlo", () => {
    const [p] = conOferta("a", "A", CV_FUERTE, "Requisitos:\n- Python y AWS.\nSalario: $50,000 MXN mensuales.");
    expect(prioridadDeResumen(p.oferta!.resumen, 0)).toEqual(prioridad(p, T0));
  });

  it("un análisis sin habilidades detectadas no inventa un número", () => {
    const [p] = conOferta("a", "A", CV_FUERTE, "Buscamos a alguien amable y puntual para nuestro equipo de oficina, con ganas de crecer con nosotros cada día.");
    expect(prioridadDeResumen(p.oferta!.resumen)).toMatchObject({ valor: null, recomendacion: "sin-analisis" });
  });

  it("editarNotas recorta, limpia vacíos y valida el id", () => {
    let l = crear([], { empresa: "A", puesto: "B" }, T0, "a");
    l = editarNotas(l, "a", "  Llamar el lunes  ", dias(1));
    expect(l[0].notas).toBe("Llamar el lunes");
    expect(editarNotas(l, "a", "   ", dias(2))[0].notas).toBeUndefined();
    expect(editarNotas(l, "a", "x".repeat(5000), dias(2))[0].notas).toHaveLength(2000);
    expect(() => editarNotas(l, "nope", "x", dias(2))).toThrow(/no encontrada/);
  });
});
