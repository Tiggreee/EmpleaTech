// Dibuja los iconos de la extensión (extension/iconos) y el mosaico de su ficha en la Chrome Web Store
// (extension/tienda) con el mismo logo de la app: triángulo naranja sobre negro. Se corre a mano cuando cambia el logo.
import { chromium } from "@playwright/test";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const iconos = path.join(raiz, "extension", "iconos");
const tienda = path.join(raiz, "extension", "tienda");
await fs.mkdir(iconos, { recursive: true });
await fs.mkdir(tienda, { recursive: true });

const NEGRO = "#0e0e0e";
const NARANJA = "#ff4f1a";
const PAPEL = "#f3f3ef";

/** El logo en un cuadro negro; en tamaños chicos el trazo es más grueso para que se lea. */
const logo = (lado, trazo) => `<svg width="${lado}" height="${lado}" viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">
  <rect width="32" height="32" fill="${NEGRO}"/>
  <path d="M16 7 L26 25.5 H6 Z" fill="none" stroke="${NARANJA}" stroke-width="${trazo}" stroke-linejoin="miter"/>
  <circle cx="16" cy="6.5" r="2.6" fill="${NARANJA}"/>
</svg>`;

const navegador = await chromium.launch();
const pagina = await navegador.newPage({ deviceScaleFactor: 1 });

async function captura(html, ancho, alto, archivo) {
  await pagina.setViewportSize({ width: ancho, height: alto });
  await pagina.setContent(`<!doctype html><html><head><style>html,body{margin:0;background:transparent}</style></head><body>${html}</body></html>`);
  await pagina.evaluate(() => document.fonts.ready);
  await pagina.screenshot({ path: archivo, omitBackground: true, clip: { x: 0, y: 0, width: ancho, height: alto } });
}

for (const [lado, trazo] of [[16, 4.2], [32, 3.4], [48, 3]]) {
  await captura(`<div style="display:block;line-height:0">${logo(lado, trazo)}</div>`, lado, lado, path.join(iconos, `icono-${lado}.png`));
}
// 128: la tienda pide 96×96 de dibujo con 16 px transparentes por lado.
await captura(`<div style="padding:16px;line-height:0">${logo(96, 2.8)}</div>`, 128, 128, path.join(iconos, "icono-128.png"));

// Mosaico chico de la ficha (440×280).
await captura(
  `<div style="width:440px;height:280px;box-sizing:border-box;background:${PAPEL};border:6px solid ${NEGRO};padding:26px 28px;display:flex;flex-direction:column;justify-content:space-between;font-family:'Arial Black',Arial,sans-serif;color:${NEGRO}">
    <div style="display:flex;align-items:center;gap:12px;line-height:0">${logo(44, 3)}<span style="font-size:26px;line-height:1;letter-spacing:-1px;text-transform:uppercase">EmpleaTech</span></div>
    <div style="font-size:34px;line-height:1;letter-spacing:-1.5px">Llena tu postulación.<br><span style="color:#b43a0b">Tú la envías.</span></div>
    <div style="font:600 10.5px/1.3 Consolas,'Courier New',monospace;letter-spacing:0.5px;white-space:nowrap;text-transform:uppercase;color:#555">Greenhouse · Lever · Ashby · Workana · Upwork · Freelancer</div>
  </div>`,
  440,
  280,
  path.join(tienda, "mosaico-440x280.png"),
);

await navegador.close();
console.log("Iconos en extension/iconos y mosaico en extension/tienda.");
