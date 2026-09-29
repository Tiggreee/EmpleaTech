import { APP_PROFILE_ID, APP_PROFILE_NAME } from "@/config/app";
import { sanitizarSeguimiento, type SeguimientoFreelance } from "@/core/freelance/freelance";
import { getPool } from "./db";

export async function leerSeguimiento(): Promise<SeguimientoFreelance> {
  const { rows } = await getPool().query(`select freelance_json from profiles where id = $1`, [APP_PROFILE_ID]);
  return sanitizarSeguimiento(rows[0]?.freelance_json);
}

export async function guardarSeguimiento(crudo: unknown): Promise<SeguimientoFreelance> {
  const s = sanitizarSeguimiento(crudo);
  await getPool().query(
    `insert into profiles (id, display_name, freelance_json) values ($1, $2, $3::jsonb)
     on conflict (id) do update set freelance_json = excluded.freelance_json, updated_at = now()`,
    [APP_PROFILE_ID, APP_PROFILE_NAME, JSON.stringify(s)],
  );
  return s;
}
