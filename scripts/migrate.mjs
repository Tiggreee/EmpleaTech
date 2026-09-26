import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import pg from "pg";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, "..");
const migrationsDir = path.join(root, "migrations");

async function cargarEntornoLocal() {
  const envPath = path.join(root, ".env");
  try {
    const raw = await fs.readFile(envPath, "utf8");
    for (const line of raw.split(/\r?\n/)) {
      const cleaned = line.trim();
      if (!cleaned || cleaned.startsWith("#")) continue;
      const eq = cleaned.indexOf("=");
      if (eq <= 0) continue;
      const key = cleaned.slice(0, eq).trim();
      const value = cleaned.slice(eq + 1).trim();
      if (!(key in process.env)) process.env[key] = value;
    }
  } catch (error) {
    if (!(error && typeof error === "object" && "code" in error && error.code === "ENOENT")) throw error;
  }
}

async function main() {
  await cargarEntornoLocal();
  const databaseUrl = process.env.DATABASE_URL?.trim();
  if (!databaseUrl) {
    throw new Error("Falta DATABASE_URL. Crea tu .env local a partir de .env.example antes de migrar.");
  }
  const pool = new pg.Pool({ connectionString: databaseUrl });
  const client = await pool.connect();
  try {
    await client.query("begin");
    await client.query(`
      create table if not exists schema_migrations (
        filename text primary key,
        applied_at timestamptz not null default now()
      )
    `);

    const files = (await fs.readdir(migrationsDir))
      .filter((name) => name.endsWith(".sql"))
      .sort((a, b) => a.localeCompare(b));

    for (const filename of files) {
      const applied = await client.query(
        "select 1 from schema_migrations where filename = $1 limit 1",
        [filename],
      );
      if (applied.rowCount) {
        console.log(`skip ${filename}`);
        continue;
      }

      const sql = await fs.readFile(path.join(migrationsDir, filename), "utf8");
      await client.query(sql);
      await client.query(
        "insert into schema_migrations (filename) values ($1)",
        [filename],
      );
      console.log(`applied ${filename}`);
    }

    await client.query("commit");
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
