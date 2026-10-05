import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Fronteras entre capas, revisadas en cada `npm test`: si un cambio las cruza, la prueba dice dónde.
 * core (dominio puro) ← server (datos e integraciones) ← API ← pantallas (features, components, ui, storage).
 */
const SRC = join(__dirname);

function archivos(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const ruta = join(dir, e.name);
    if (e.isDirectory()) return archivos(ruta);
    return /\.tsx?$/.test(e.name) && !/\.test\.tsx?$/.test(e.name) ? [ruta] : [];
  });
}

/** Cada import y re-export del archivo, y si es solo de tipos. */
function imports(ruta: string): { desde: string; soloTipos: boolean }[] {
  const texto = readFileSync(ruta, "utf8");
  return [...texto.matchAll(/^\s*(import|export)\s+(type\s+)?[^;]*?from\s+["']([^"']+)["']/gm)].map((m) => ({ desde: m[3], soloTipos: !!m[2] }));
}

function violaciones(capa: string, prohibido: RegExp, permitirTipos = false): string[] {
  return archivos(join(SRC, capa)).flatMap((ruta) =>
    imports(ruta)
      .filter((i) => prohibido.test(i.desde) && !(permitirTipos && i.soloTipos))
      .map((i) => `${relative(SRC, ruta)} → ${i.desde}`),
  );
}

describe("arquitectura por capas", () => {
  it("core no depende de nada de afuera: ni servidor, ni interfaz, ni React o Next", () => {
    expect(violaciones("core", /^(@\/(server|storage|ui|features|components|app|content)\/|react|next)/)).toEqual([]);
  });

  it("server no conoce las pantallas", () => {
    expect(violaciones("server", /^@\/(storage|ui|features|components|app)\//)).toEqual([]);
  });

  it("las pantallas hablan con el servidor por /api: de server/ solo toman tipos", () => {
    for (const capa of ["features", "components", "ui", "storage"]) expect(violaciones(capa, /^@\/server\//, true)).toEqual([]);
  });
});
