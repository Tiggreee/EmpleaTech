import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import pg from "pg";
import { RAIZ as root, cargarEntornoLocal } from "./entorno.mjs";

const migrationsDir = path.join(root, "migrations");

async function main() {
  cargarEntornoLocal();
  // Para migrar conviene la conexión directa (Neon la da como DATABASE_URL_UNPOOLED); la de pool, si no hay otra.
  const databaseUrl = process.env.DATABASE_URL_UNPOOLED?.trim() || process.env.DATABASE_URL?.trim();
  if (!databaseUrl) {
    // En el primer despliegue la base todavía no está conectada: se compila igual y se migra en el siguiente.
    if (process.argv.includes("--si-hay-base")) {
      console.warn("Sin DATABASE_URL: no migré. Conecta la base y vuelve a desplegar.");
      return;
    }
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
