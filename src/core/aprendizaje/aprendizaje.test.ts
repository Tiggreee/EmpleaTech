import { describe, expect, it } from "vitest";
import { cambiarEstado, crear, marcarPostulada, SELLO_ITEMS, type Postulacion } from "../seguimiento/seguimiento";
import { crearVacante, type FuenteId, type Vacante } from "../vacantes/vacante";
import { MIN_TOTAL, ajustePorAprendizaje, aprender, huellaAprendizaje, nivelDeTitulo, registrosDe, wilson } from "./aprendizaje";

const AHORA = new Date("2026-09-28T12:00:00Z");

function vacante(i: number, fuente: FuenteId): Vacante {
  const v = crearVacante(fuente, { idExterno: String(i), titulo: `Backend ${i}`, empresa: `Empresa ${i}`, url: `https://ejemplo.com/${fuente}/${i}`, modalidad: "remoto", descripcion: "" });
  if (!v) throw new Error("vacante inválida");
  return v;
}

/** n postulaciones enviadas desde `fuente`; las primeras `entrevistas` llegaron a entrevista. */
function enviar(lista: Postulacion[], vacantes: Vacante[], fuente: FuenteId, n: number, entrevistas: number, desde: number): Postulacion[] {
  let l = lista;
  for (let i = 0; i < n; i++) {
    const v = vacante(desde + i, fuente);
    vacantes.push(v);
    const id = `p${desde + i}`;
    l = crear(l, { empresa: v.empresa, puesto: v.titulo, url: v.url }, AHORA, id);
    l = marcarPostulada(l, id, [...SELLO_ITEMS], AHORA);
    if (i < entrevistas) l = cambiarEstado(l, id, "entrevista", new Date(AHORA.getTime() + 5 * 86_400_000));
  }
  return l;
}

describe("aprendizaje", () => {
  it("cada postulación enviada se cruza con su vacante; las demás son «por tu cuenta»", () => {
    const vacantes: Vacante[] = [];
    let l = enviar([], vacantes, "getonboard", 1, 1, 0);
    l = marcarPostulada(crear(l, { empresa: "Otra", puesto: "Senior Dev", url: "https://otra.com/job" }, AHORA, "m"), "m", [...SELLO_ITEMS], AHORA);
    l = crear(l, { empresa: "Guardada", puesto: "Dev" }, AHORA, "g"); // no enviada: no cuenta
    const r = registrosDe(l, vacantes, {});
    expect(r).toHaveLength(2);
    expect(r.find((x) => x.id === "p0")).toMatchObject({ entrevista: true, diasARespuesta: 5, dim: { fuente: "Get on Board", modalidad: "Remoto" } });
    expect(r.find((x) => x.id === "m")?.dim).toMatchObject({ fuente: "Por tu cuenta", nivel: "Senior", modalidad: "Sin dato" });
  });

  it("con pocos datos no concluye ni mueve el ranking", () => {
    const vacantes: Vacante[] = [];
    const a = aprender(registrosDe(enviar([], vacantes, "remotive", 5, 1, 0), vacantes, {}), AHORA);
    expect(a.suficiente).toBe(false);
    expect(a.recomendaciones[0].texto).toMatch(`Con ${MIN_TOTAL} empezamos`);
    expect(ajustePorAprendizaje(a, vacante(99, "remotive"))).toBeNull();
    expect(huellaAprendizaje(a)).toBe("sin-datos");
  });

  it("con datos suficientes, recomienda y ajusta el ranking de forma acotada", () => {
    const vacantes: Vacante[] = [];
    let l = enviar([], vacantes, "getonboard", 10, 5, 0);
    l = enviar(l, vacantes, "remotive", 20, 1, 100);
    const a = aprender(registrosDe(l, vacantes, {}), AHORA);
    expect(a).toMatchObject({ total: 30, entrevistas: 6, suficiente: true, diasPromedioRespuesta: 5 });
    expect(a.tasa).toBeCloseTo(0.2);
    const [gob, rem] = a.porDimension.fuente;
    expect(gob).toMatchObject({ valor: "Get on Board", n: 10, entrevistas: 5, pocosDatos: false });
    // Suavizada hacia el promedio: 50% crudo, algo menos al ajustar.
    expect(gob.suavizada).toBeLessThan(0.5);
    expect(gob.suavizada).toBeGreaterThan(0.2);
    expect(rem.valor).toBe("Remotive");
    const textos = a.recomendaciones.map((x) => x.texto).join(" ");
    expect(textos).toMatch(/Plataforma «Get on Board»: 50% de entrevistas en 10/);
    expect(textos).toMatch(/Plataforma «Remotive»: 5% de entrevistas en 20/);

    const mas = ajustePorAprendizaje(a, vacante(500, "getonboard"));
    const menos = ajustePorAprendizaje(a, vacante(501, "remotive"));
    expect(mas?.puntos).toBeGreaterThan(0);
    expect(menos?.puntos).toBeLessThan(0);
    expect(Math.abs(mas?.puntos ?? 0)).toBeLessThanOrEqual(10);
    expect(mas?.motivo).toMatch(/^Según tus resultados: Get on Board te responde más \(\+\d+\)$/);
    expect(huellaAprendizaje(a)).not.toBe("sin-datos");
  });

  it("intervalo de Wilson y niveles de puesto", () => {
    const [bajo, alto] = wilson(2, 2);
    expect(bajo).toBeGreaterThan(0.3);
    expect(alto).toBe(1);
    expect(wilson(0, 0)).toEqual([0, 1]);
    expect(nivelDeTitulo("Senior Backend Developer")).toBe("Senior");
    expect(nivelDeTitulo("Tech Lead")).toBe("Líder");
    expect(nivelDeTitulo("Desarrollador Jr.")).toBe("Entrada");
    expect(nivelDeTitulo("Backend Developer")).toBe("Medio");
  });
});
