/**
 * Lo que comparten los scripts locales: leer tu .env, dónde viven tus datos fuera del repositorio y cómo correr
 * herramientas de Postgres (dentro del contenedor de Docker si existe, o las que tengas instaladas).
 */
import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

export const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/** Carga las variables de tu .env sin pisar las que ya existan en el entorno. */
export function cargarEntornoLocal(archivo = path.join(RAIZ, ".env")) {
  let raw;
  try {
    raw = fs.readFileSync(archivo, "utf8");
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") return;
    throw error;
  }
  for (const linea of raw.replace(/^﻿/, "").split(/\r?\n/)) {
    const limpia = linea.trim();
    if (!limpia || limpia.startsWith("#")) continue;
    const eq = limpia.indexOf("=");
    if (eq <= 0) continue;
    const clave = limpia.slice(0, eq).trim();
    const valor = limpia.slice(eq + 1).trim().replace(/^(["'])(.*)\1$/, "$2");
    if (!(clave in process.env)) process.env[clave] = valor;
  }
}

/** Carpeta de datos locales (respaldos y registros). Nunca dentro del repositorio. */
export function carpetaDatos(env = process.env, plataforma = process.platform, home = os.homedir()) {
  if (env.EMPLEATECH_DATOS?.trim()) return path.resolve(env.EMPLEATECH_DATOS.trim());
  if (plataforma === "win32") return path.join(env.LOCALAPPDATA || path.join(home, "AppData", "Local"), "EmpleaTech");
  if (plataforma === "darwin") return path.join(home, "Library", "Application Support", "EmpleaTech");
  return path.join(env.XDG_DATA_HOME || path.join(home, ".local", "share"), "empleatech");
}

export function urlDeBase() {
  const url = process.env.DATABASE_URL?.trim();
  if (!url) throw new Error("Falta DATABASE_URL. Crea tu .env local a partir de .env.example.");
  return url;
}

/** Usuario y base de una URL de Postgres, para las herramientas que corren dentro del contenedor. */
export function datosDeConexion(url) {
  const u = new URL(url);
  return { usuario: decodeURIComponent(u.username) || "postgres", base: decodeURIComponent(u.pathname.replace(/^\//, "")) || "postgres" };
}

export const CONTENEDOR = () => process.env.EMPLEATECH_CONTENEDOR_DB?.trim() || "empleatech-postgres";

/** Corre un comando y devuelve su salida; no lanza si falla. */
export function correr(cmd, args, opciones = {}) {
  const r = spawnSync(cmd, args, { encoding: "utf8", windowsHide: true, ...opciones });
  return { ok: r.status === 0, salida: (r.stdout ?? "").trim(), error: (r.stderr ?? "").trim() || r.error?.message || "" };
}

export function contenedorCorriendo(nombre = CONTENEDOR()) {
  const r = correr("docker", ["inspect", "--format", "{{.State.Running}}", nombre], { timeout: 15_000 });
  return r.ok && r.salida === "true";
}

/**
 * Cómo invocar una herramienta de Postgres (pg_dump, pg_restore, psql) contra tu base: dentro del contenedor si está
 * corriendo (misma versión que el servidor, sin contraseñas), o la del sistema con DATABASE_URL.
 */
export function herramientaPg(programa, { base } = {}) {
  const url = urlDeBase();
  const conexion = datosDeConexion(url);
  const destino = base ?? conexion.base;
  if (contenedorCorriendo()) {
    return { cmd: "docker", args: ["exec", "-i", CONTENEDOR(), programa, "-U", conexion.usuario, "-d", destino] };
  }
  const u = new URL(url);
  u.pathname = `/${encodeURIComponent(destino)}`;
  return { cmd: programa, args: [`--dbname=${u.toString()}`] };
}

/**
 * Corre una herramienta de Postgres conectando archivos a su entrada y salida estándar. Resuelve con el código de
 * salida y lo que escribió en stderr.
 */
export function correrPg({ cmd, args }, { entrada, salida } = {}) {
  return new Promise((resolve, reject) => {
    const hijo = spawn(cmd, args, { windowsHide: true, stdio: [entrada ? "pipe" : "ignore", salida ? "pipe" : "ignore", "pipe"] });
    let errores = "";
    hijo.stderr.on("data", (d) => (errores += d));
    hijo.on("error", (e) =>
      reject(e.code === "ENOENT" ? new Error(`No encontré «${cmd}». Abre Docker Desktop (o instala las herramientas de Postgres) y vuelve a intentar.`) : e),
    );
    let pendientes = 1;
    let codigo = 0;
    const terminar = () => --pendientes === 0 && resolve({ codigo, errores: errores.trim() });
    if (salida) {
      pendientes++;
      const destino = fs.createWriteStream(salida);
      hijo.stdout.pipe(destino);
      destino.on("finish", terminar);
      destino.on("error", reject);
    }
    if (entrada) fs.createReadStream(entrada).on("error", reject).pipe(hijo.stdin);
    hijo.on("close", (c) => {
      codigo = c ?? 1;
      terminar();
    });
  });
}
