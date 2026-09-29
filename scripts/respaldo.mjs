/**
 * Respaldos de tu base local con pg_dump (formato custom, comprimido). Viven fuera del repositorio, se verifican al
 * terminar y se rotan: los 14 más recientes y uno por semana de las 8 semanas anteriores.
 *
 *   npm run respaldo                      respalda ahora
 *   npm run respaldo -- --si-toca         solo si el último tiene más de 20 h (lo usa el arranque automático)
 *   npm run respaldo -- --lista           muestra tus respaldos
 *   npm run respaldo -- --probar          restaura el último en una base temporal, cuenta filas y la borra
 *   npm run restaurar -- ultimo|<archivo> reemplaza tu base con un respaldo (antes respalda la actual)
 */
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { CONTENEDOR, carpetaDatos, cargarEntornoLocal, contenedorCorriendo, correr, correrPg, datosDeConexion, herramientaPg, urlDeBase } from "./entorno.mjs";

const PREFIJO = "empleatech-";
const EXTENSION = ".dump";
const RE_NOMBRE = /^empleatech-(\d{4})-(\d{2})-(\d{2})_(\d{2})(\d{2})(\d{2})(?:-[a-z-]+)?\.dump$/;
const HORA = 3_600_000;
const DIA = 24 * HORA;

const dos = (n) => String(n).padStart(2, "0");

/** empleatech-2026-09-29_041500.dump (hora local, para que lo leas tal cual). */
export function nombreDeRespaldo(fecha, motivo) {
  const sello = `${fecha.getFullYear()}-${dos(fecha.getMonth() + 1)}-${dos(fecha.getDate())}_${dos(fecha.getHours())}${dos(fecha.getMinutes())}${dos(fecha.getSeconds())}`;
  return `${PREFIJO}${sello}${motivo ? `-${motivo}` : ""}${EXTENSION}`;
}

export function fechaDeNombre(nombre) {
  const m = RE_NOMBRE.exec(nombre);
  if (!m) return null;
  const [, a, mes, d, h, min, s] = m.map(Number);
  return new Date(a, mes - 1, d, h, min, s);
}

/** Qué respaldos conservar: los `recientes` más nuevos y, de los anteriores, el más nuevo de cada semana hasta `semanas`. */
export function aConservar(nombres, { recientes = 14, semanas = 8 } = {}) {
  const validos = nombres
    .map((n) => ({ n, f: fechaDeNombre(n) }))
    .filter((x) => x.f)
    .sort((a, b) => b.f.getTime() - a.f.getTime());
  const conservar = new Set(validos.slice(0, recientes).map((x) => x.n));
  const vistas = new Set();
  for (const { n, f } of validos.slice(recientes)) {
    // Semanas que empiezan en lunes: el 5 de enero de 1970 fue lunes.
    const semana = Math.floor((f.getTime() - new Date(1970, 0, 5).getTime()) / (7 * DIA));
    if (vistas.has(semana)) continue;
    if (vistas.size >= semanas) break;
    vistas.add(semana);
    conservar.add(n);
  }
  return conservar;
}

export function carpetaRespaldos() {
  return path.join(carpetaDatos(), "respaldos");
}

/** Respaldos existentes, del más nuevo al más viejo. */
export function listarRespaldos(carpeta = carpetaRespaldos()) {
  if (!fs.existsSync(carpeta)) return [];
  return fs
    .readdirSync(carpeta)
    .map((nombre) => ({ nombre, fecha: fechaDeNombre(nombre) }))
    .filter((x) => x.fecha)
    .map((x) => ({ ...x, ruta: path.join(carpeta, x.nombre), bytes: fs.statSync(path.join(carpeta, x.nombre)).size }))
    .sort((a, b) => b.fecha.getTime() - a.fecha.getTime());
}

/** pg_restore sin conectarse a ninguna base (solo para leer el índice del archivo). */
function pgRestoreSinConexion() {
  return contenedorCorriendo() ? { cmd: "docker", args: ["exec", "-i", CONTENEDOR(), "pg_restore"] } : { cmd: "pg_restore", args: [] };
}

/** Verifica que el archivo sea un respaldo legible y cuenta las tablas con datos que trae. */
function verificarArchivo(ruta) {
  const { cmd, args } = pgRestoreSinConexion();
  const r = correr(cmd, [...args, "--list"], { input: fs.readFileSync(ruta), maxBuffer: 64 * 1024 * 1024 });
  if (!r.ok) throw new Error(`El respaldo no se pudo leer: ${r.error || "pg_restore falló"}`);
  const tablas = r.salida.split(/\r?\n/).filter((l) => / TABLE DATA /.test(l)).length;
  if (!tablas) throw new Error("El respaldo no trae ninguna tabla con datos.");
  return tablas;
}

function formatoTamano(bytes) {
  return bytes < 1024 * 1024 ? `${(bytes / 1024).toFixed(0)} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export async function respaldar({ siToca = false, horas = 20, motivo, ahora = new Date(), carpeta = carpetaRespaldos() } = {}) {
  fs.mkdirSync(carpeta, { recursive: true });
  const previos = listarRespaldos(carpeta);
  if (siToca && previos[0] && ahora.getTime() - previos[0].fecha.getTime() < horas * HORA) {
    return { omitido: true, ultimo: previos[0] };
  }

  const nombre = nombreDeRespaldo(ahora, motivo);
  const final = path.join(carpeta, nombre);
  const parcial = `${final}.parcial`;
  try {
    const { cmd, args } = herramientaPg("pg_dump");
    const { codigo, errores } = await correrPg({ cmd, args: [...args, "--format=custom", "--no-owner", "--no-privileges"] }, { salida: parcial });
    if (codigo !== 0) throw new Error(`pg_dump falló: ${errores || `código ${codigo}`}`);
    const tablas = verificarArchivo(parcial);
    fs.renameSync(parcial, final);

    // Rotación: solo toca archivos con nuestro nombre; los .parcial viejos son de intentos que se cortaron.
    const conservar = aConservar(listarRespaldos(carpeta).map((r) => r.nombre));
    for (const r of listarRespaldos(carpeta)) if (!conservar.has(r.nombre)) fs.rmSync(r.ruta, { force: true });
    for (const n of fs.readdirSync(carpeta)) {
      const ruta = path.join(carpeta, n);
      if (n.endsWith(".parcial") && ahora.getTime() - fs.statSync(ruta).mtimeMs > DIA) fs.rmSync(ruta, { force: true });
    }
    return { omitido: false, ruta: final, bytes: fs.statSync(final).size, tablas };
  } catch (error) {
    fs.rmSync(parcial, { force: true });
    throw error;
  }
}

function elegirRespaldo(cual) {
  if (!cual || cual === "ultimo" || cual === "último") {
    const ultimo = listarRespaldos()[0];
    if (!ultimo) throw new Error(`No hay respaldos en ${carpetaRespaldos()}.`);
    return ultimo.ruta;
  }
  const ruta = fs.existsSync(cual) ? cual : path.join(carpetaRespaldos(), cual);
  if (!fs.existsSync(ruta)) throw new Error(`No encontré el respaldo «${cual}».`);
  return ruta;
}

function psql(sql, base) {
  const { cmd, args } = herramientaPg("psql", { base });
  const r = correr(cmd, [...args, "-v", "ON_ERROR_STOP=1", "-At", "-c", sql]);
  if (!r.ok) throw new Error(r.error || "psql falló");
  return r.salida;
}

const CONTEO_FILAS = `select table_name || '=' || (xpath('/row/c/text()', query_to_xml(format('select count(*) as c from %I.%I', table_schema, table_name), false, true, '')))[1]::text
  from information_schema.tables where table_schema = 'public' and table_type = 'BASE TABLE' order by 1`;

/** Restaura un respaldo en una base temporal, cuenta sus filas y la borra. Tu base no se toca. */
export async function probarRespaldo(cual) {
  const ruta = elegirRespaldo(cual);
  const temporal = `${datosDeConexion(urlDeBase()).base}_prueba_respaldo`;
  psql(`drop database if exists "${temporal}"`);
  psql(`create database "${temporal}"`);
  try {
    const { cmd, args } = herramientaPg("pg_restore", { base: temporal });
    const { codigo, errores } = await correrPg({ cmd, args: [...args, "--no-owner", "--no-privileges", "--exit-on-error"] }, { entrada: ruta });
    if (codigo !== 0) throw new Error(`No se pudo restaurar: ${errores || `código ${codigo}`}`);
    const conteo = Object.fromEntries(
      psql(CONTEO_FILAS, temporal)
        .split(/\r?\n/)
        .filter(Boolean)
        .map((l) => {
          const [t, n] = l.split("=");
          return [t, Number(n)];
        }),
    );
    return { ruta, conteo };
  } finally {
    psql(`drop database if exists "${temporal}"`);
  }
}

/** Reemplaza tu base con un respaldo. Antes respalda la actual, por si te arrepientes. */
export async function restaurar(cual) {
  const ruta = elegirRespaldo(cual);
  const previo = await respaldar({ motivo: "antes-de-restaurar" });
  const { cmd, args } = herramientaPg("pg_restore");
  const { codigo, errores } = await correrPg(
    { cmd, args: [...args, "--clean", "--if-exists", "--no-owner", "--no-privileges", "--single-transaction", "--exit-on-error"] },
    { entrada: ruta },
  );
  if (codigo !== 0) throw new Error(`No se pudo restaurar (tu base quedó como estaba): ${errores || `código ${codigo}`}`);
  return { ruta, previo: previo.ruta };
}

async function main(argv) {
  cargarEntornoLocal();
  const bandera = (b) => argv.includes(b);
  if (bandera("--lista")) {
    const lista = listarRespaldos();
    console.log(lista.length ? lista.map((r) => `${r.nombre}  ${formatoTamano(r.bytes)}`).join("\n") : "Aún no hay respaldos.");
    console.log(`\nCarpeta: ${carpetaRespaldos()}`);
    return;
  }
  if (bandera("--probar")) {
    const { ruta, conteo } = await probarRespaldo(argv[argv.indexOf("--probar") + 1]);
    const filas = Object.values(conteo).reduce((a, b) => a + b, 0);
    console.log(`Respaldo sano: ${path.basename(ruta)} se restauró completo (${Object.keys(conteo).length} tablas, ${filas} filas).`);
    for (const [t, n] of Object.entries(conteo)) console.log(`  ${t}: ${n}`);
    return;
  }
  if (bandera("--restaurar")) {
    const { ruta, previo } = await restaurar(argv[argv.indexOf("--restaurar") + 1]);
    console.log(`Listo: tu base quedó como en ${path.basename(ruta)}.\nLo que tenías antes quedó en ${previo}.`);
    return;
  }
  const r = await respaldar({ siToca: bandera("--si-toca") });
  if (r.omitido) console.log(`El último respaldo es reciente (${r.ultimo.nombre}); no hace falta otro.`);
  else console.log(`Respaldo listo: ${r.ruta} (${formatoTamano(r.bytes)}, ${r.tablas} tablas).`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main(process.argv.slice(2)).catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
