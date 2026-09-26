const DEFAULT_DATABASE_URL = "postgres://postgres:postgres@127.0.0.1:5432/empleatech_mvp";

export function databaseUrl(): string {
  const value = process.env.DATABASE_URL?.trim();
  return value || DEFAULT_DATABASE_URL;
}

