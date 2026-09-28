import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import pg from "pg";

const RAIZ = path.resolve(__dirname, "..");

function leerDotEnv(): Record<string, string> {
  try {
    const out: Record<string, string> = {};
    for (const linea of fs.readFileSync(path.join(RAIZ, ".env"), "utf8").split(/\r?\n/)) {
      const l = linea.trim();
      const eq = l.indexOf("=");
      if (!l || l.startsWith("#") || eq <= 0) continue;
      out[l.slice(0, eq).trim()] = l.slice(eq + 1).trim();
    }
    return out;
  } catch {
    return {};
  }
}

/**
 * Base que usan las pruebas e2e. En CI es la base desechable del job; en tu máquina es una copia aparte
 * (<tu_base>_e2e) para que las pruebas, que borran datos, nunca toquen los tuyos.
 */
export function urlBaseE2e(): string {
  if (process.env.E2E_DATABASE_URL) return process.env.E2E_DATABASE_URL;
  const base = process.env.DATABASE_URL ?? leerDotEnv().DATABASE_URL;
  if (!base) throw new Error("Falta DATABASE_URL (o E2E_DATABASE_URL) para las pruebas e2e.");
  if (process.env.CI) return base;
  const u = new URL(base);
  const nombre = u.pathname.replace(/^\//, "") || "empleatech";
  u.pathname = `/${nombre.endsWith("_e2e") ? nombre : `${nombre}_e2e`}`;
  return u.toString();
}

export default async function prepararBase(): Promise<void> {
  const url = new URL(urlBaseE2e());
  const nombre = url.pathname.replace(/^\//, "");
  if (!/^[a-z0-9_]+$/i.test(nombre)) throw new Error(`Nombre de base e2e inválido: ${nombre}`);

  const admin = new URL(url);
  admin.pathname = "/postgres";
  const cliente = new pg.Client({ connectionString: admin.toString() });
  await cliente.connect();
  try {
    const existe = await cliente.query("select 1 from pg_database where datname = $1", [nombre]);
    if (!existe.rowCount) await cliente.query(`create database "${nombre}"`);
  } finally {
    await cliente.end();
  }

  execFileSync(process.execPath, [path.join(RAIZ, "scripts", "migrate.mjs")], {
    env: { ...process.env, DATABASE_URL: url.toString() },
    stdio: "inherit",
  });
}
