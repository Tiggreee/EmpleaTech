import { describe, expect, it } from "vitest";
import { aniosDelCv, inglesDelCv, respuestasConElCv } from "./delCv";
import { leerPerfil } from "./estructurado";
import { sanitizarRespuestas } from "./respuestas";

const AHORA = new Date("2026-09-28T12:00:00Z");

const CV = `Ana Torres
Desarrolladora Backend
Guadalajara, México | ana@correo.mx

Experiencia
Desarrolladora Backend — Acme Pagos
Ene 2021 – Presente
- Diseñé la API de cobros en Node.js con PostgreSQL.

Programadora — Globant
03/2018 - 12/2021
- Mantuve aplicaciones en Java.

Idiomas
Español — Nativo
Inglés — B2`;

const { perfil } = leerPerfil(CV);
const conIngles = (fluency?: string) => ({ ...perfil, languages: [{ language: "English", ...(fluency ? { fluency } : {}) }] });

describe("lo que tu CV ya contesta", () => {
  it("años de experiencia sin contar dos veces los puestos que se traslapan", () => {
    expect(aniosDelCv(perfil, AHORA)).toBe(8);
    expect(aniosDelCv({ ...perfil, work: [] }, AHORA)).toBeUndefined();
  });

  it("nivel de inglés tal como lo escribiste; sin nivel escrito, no se adivina", () => {
    expect(inglesDelCv(perfil)).toBe("intermedio");
    expect(inglesDelCv(conIngles("fluent"))).toBe("avanzado");
    expect(inglesDelCv(conIngles("Professional working proficiency"))).toBe("avanzado");
    expect(inglesDelCv(conIngles("Bilingüe"))).toBe("nativo");
    expect(inglesDelCv(conIngles("A2"))).toBe("basico");
    expect(inglesDelCv(conIngles())).toBeUndefined();
  });

  it("completa lo que no contestaste; lo que declaraste manda y el país nunca sale del CV", () => {
    const r = respuestasConElCv(sanitizarRespuestas({}), perfil, AHORA);
    expect(r.aniosExperiencia).toBe(8);
    expect(r.nivelIngles).toBe("intermedio");
    expect(r.paisesAutorizado).toEqual([]);

    const tuyas = respuestasConElCv(sanitizarRespuestas({ aniosExperiencia: 5, nivelIngles: "avanzado" }), perfil, AHORA);
    expect(tuyas.aniosExperiencia).toBe(5);
    expect(tuyas.nivelIngles).toBe("avanzado");

    const sinCv = sanitizarRespuestas({});
    expect(respuestasConElCv(sinCv, undefined, AHORA)).toBe(sinCv);
  });
});
