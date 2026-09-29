// Empaqueta la extensión de Chrome en extension/dist (carpeta que se carga en chrome://extensions).
import { build } from "esbuild";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const origen = path.join(raiz, "extension");
const salida = path.join(origen, "dist");

await fs.rm(salida, { recursive: true, force: true });
await build({
  entryPoints: { contenido: path.join(origen, "src", "contenido.ts"), propuesta: path.join(origen, "src", "propuesta.ts"), fondo: path.join(origen, "src", "fondo.ts"), opciones: path.join(origen, "src", "opciones.ts") },
  outdir: salida,
  bundle: true,
  format: "iife",
  target: "chrome120",
  tsconfig: path.join(raiz, "tsconfig.json"),
  legalComments: "none",
  logLevel: "warning",
});
for (const f of ["manifest.json", "opciones.html"]) await fs.copyFile(path.join(origen, f), path.join(salida, f));
console.log(`Extensión lista en ${path.relative(raiz, salida)}`);
