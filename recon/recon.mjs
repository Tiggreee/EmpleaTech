#!/usr/bin/env node
// Recon público y ético de EmpleaTech.
//  - Lee robots.txt ANTES de pedir cualquier ruta y omite lo prohibido.
//  - Se identifica con un User-Agent honesto (nada de suplantar navegadores).
//  - NO guarda HTML ni JS ajeno: solo estado HTTP, cabeceras de fingerprint y señales derivadas.
//  - NO extrae claves ni datos de configuración de terceros.
//
// Uso:  node recon/recon.mjs --dry-run   (offline: evalúa robots con fixtures)
//       node recon/recon.mjs             (pide las páginas permitidas, 1 s entre peticiones)
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { parseRobots, permitido } from "./robots.mjs";

const UA = "EmpleaTechRecon/0.1 (investigacion publica; solo lectura)";
const DRY = process.argv.includes("--dry-run");
const PAUSA_MS = 1000;

const OBJETIVOS = [
  { host: "jobright.ai", rutas: ["/", "/job-autofill", "/assistant", "/ai-resume-builder", "/legal/service"] },
  { host: "simplify.jobs", rutas: ["/", "/helper", "/ai-talent-agent", "/resume-builder"] },
  { host: "torre.ai", rutas: ["/", "/headhunt", "/api", "/solutions"] },
];

const dormir = (ms) => new Promise((r) => setTimeout(r, ms));

async function robotsDe(host) {
  if (DRY) return parseRobots(readFileSync(new URL(`./fixtures/${host}.robots.txt`, import.meta.url), "utf8"));
  const res = await fetch(`https://${host}/robots.txt`, { headers: { "user-agent": UA }, signal: AbortSignal.timeout(20000) });
  return parseRobots(res.ok ? await res.text() : "");
}

function senales(html) {
  const c = (re) => (html.match(re) ?? []).length;
  return {
    scripts: c(/<script[^>]+src=/gi),
    next: c(/_next\//g) > 0,
    nuxt: c(/_nuxt|__NUXT__/g) > 0,
    bytes: html.length,
  };
}

const salida = [];
for (const { host, rutas } of OBJETIVOS) {
  let robots;
  try {
    robots = await robotsDe(host);
  } catch (e) {
    console.log(`[${host}] no se pudo leer robots.txt (${e.message}); se omite el host por prudencia.`);
    continue;
  }
  for (const ruta of rutas) {
    if (!permitido(robots, UA, ruta)) {
      console.log(`SKIP  ${host}${ruta}  (robots.txt lo prohíbe)`);
      salida.push({ host, ruta, accion: "omitida-por-robots" });
      continue;
    }
    if (DRY) {
      console.log(`OK    ${host}${ruta}  (permitida; dry-run, sin petición)`);
      salida.push({ host, ruta, accion: "permitida-dry-run" });
      continue;
    }
    try {
      const res = await fetch(`https://${host}${ruta}`, { headers: { "user-agent": UA }, signal: AbortSignal.timeout(30000) });
      const html = await res.text();
      const h = (n) => res.headers.get(n) ?? undefined;
      salida.push({
        host,
        ruta,
        accion: "consultada",
        estado: res.status,
        servidor: h("server"),
        poweredBy: h("x-powered-by"),
        cdn: h("cf-ray") ? "cloudflare" : h("x-vercel-cache") ? "vercel" : undefined,
        hsts: Boolean(h("strict-transport-security")),
        csp: Boolean(h("content-security-policy")),
        ...senales(html),
      });
      console.log(`GET   ${host}${ruta}  -> ${res.status}`);
    } catch (e) {
      console.log(`FAIL  ${host}${ruta}  (${e.message})`);
      salida.push({ host, ruta, accion: "error", error: e.message });
    }
    await dormir(PAUSA_MS);
  }
}

mkdirSync(new URL("./out/", import.meta.url), { recursive: true });
writeFileSync(
  new URL("./out/signals.json", import.meta.url),
  JSON.stringify({ generadoEn: new Date().toISOString(), modo: DRY ? "dry-run" : "live", ua: UA, resultados: salida }, null, 2),
);
console.log(`\nListo: recon/out/signals.json (${salida.length} entradas).`);

