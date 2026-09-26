import type { PoolConfig } from "pg";

function leerEnteroPositivo(name: string, porDefecto: number): number {
  const value = process.env[name]?.trim();
  if (!value) return porDefecto;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : porDefecto;
}

export function databaseUrl(): string {
  const value = process.env.DATABASE_URL?.trim();
  if (!value) throw new Error("Falta DATABASE_URL. Crea tu .env local a partir de .env.example.");
  return value;
}

export function poolConfig(): PoolConfig {
  return {
    connectionString: databaseUrl(),
    max: leerEnteroPositivo("PGPOOL_MAX", 5),
    idleTimeoutMillis: 10_000,
    connectionTimeoutMillis: 5_000,
    maxUses: 5_000,
  };
}
