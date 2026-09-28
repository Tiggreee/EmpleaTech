import { describe, expect, it } from "vitest";
import { buscarVacantes } from "@/core/vacantes/busqueda";
import type { Consulta } from "@/core/vacantes/fuentes";
import { ADAPTADORES, EMPRESAS_INICIALES, contextoReal } from "./index";

/**
 * Prueba contra las APIs reales para detectar cambios de formato. Usa internet, así que solo corre a mano:
 *   EMPLEATECH_PRUEBA_VIVO=1 npx vitest run src/server/fuentes/vivo.test.ts
 */
const activa = process.env.EMPLEATECH_PRUEBA_VIVO === "1";

describe.skipIf(!activa)("fuentes reales (con internet)", () => {
  it("cada fuente gratuita responde y produce vacantes válidas", { timeout: 120_000 }, async () => {
    const gratuitas = Object.values(ADAPTADORES).filter((f) => !f.info.claves.length);
    const consulta: Consulta = { palabras: ["developer", "engineer", "desarrollador"], soloRemoto: false, paises: [], empresas: EMPRESAS_INICIALES, maxPorFuente: 1000 };
    const { vacantes, reporte } = await buscarVacantes(gratuitas, consulta, contextoReal(), { forzar: true, timeoutMs: 60_000 });
    console.table(reporte);
    for (const r of reporte) expect(r.estado, `${r.fuente}: ${r.detalle ?? ""}`).toBe("ok");
    for (const r of reporte) expect(r.encontradas, r.fuente).toBeGreaterThan(0);
    expect(vacantes.length).toBeGreaterThan(20);
    for (const v of vacantes.slice(0, 200)) {
      expect(v.url).toMatch(/^https?:\/\//);
      expect(v.titulo.length).toBeGreaterThan(1);
    }
  });
});
