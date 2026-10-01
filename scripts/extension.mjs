// Empaqueta la extensión de Chrome en extension/dist (carpeta que se carga en chrome://extensions) y deja junto a ella
// el zip que se sube a la Chrome Web Store (extension/empleatech-<versión>.zip).
import { build } from "esbuild";
import JSZip from "jszip";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const origen = path.join(raiz, "extension");
const salida = path.join(origen, "dist");

await fs.rm(salida, { recursive: true, force: true });
await build({
  entryPoints: {
    contenido: path.join(origen, "src", "contenido.ts"),
    propuesta: path.join(origen, "src", "propuesta.ts"),
    conectar: path.join(origen, "src", "conectar.ts"),
    fondo: path.join(origen, "src", "fondo.ts"),
    opciones: path.join(origen, "src", "opciones.ts"),
  },
  outdir: salida,
  bundle: true,
  format: "iife",
  target: "chrome120",
  tsconfig: path.join(raiz, "tsconfig.json"),
  legalComments: "none",
  logLevel: "warning",
});
for (const f of ["manifest.json", "opciones.html"]) await fs.copyFile(path.join(origen, f), path.join(salida, f));
await fs.cp(path.join(origen, "iconos"), path.join(salida, "iconos"), { recursive: true });

// Zip para la tienda: el manifest en la raíz, sin carpetas de más.
const { version } = JSON.parse(await fs.readFile(path.join(origen, "manifest.json"), "utf8"));
const zip = new JSZip();
for (const f of await fs.readdir(salida, { recursive: true, withFileTypes: true })) {
  if (!f.isFile()) continue;
  const completo = path.join(f.parentPath, f.name);
  zip.file(path.relative(salida, completo).split(path.sep).join("/"), await fs.readFile(completo));
}
const paquete = path.join(origen, `empleatech-${version}.zip`);
await fs.writeFile(paquete, await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" }));
console.log(`Extensión lista en ${path.relative(raiz, salida)} y ${path.relative(raiz, paquete)}`);
