import { randomBytes } from "node:crypto";
import { getPool } from "./db";

/**
 * Tu cuenta cuando EmpleaTech vive en internet: una sola fila (una sola persona). Guarda el hash de la contraseña, el
 * sello de las sesiones y la verificación en dos pasos.
 */

export interface Cuenta {
  hash: string;
  sello: string;
  /** Secreto TOTP cifrado (ver server/totp); existe desde que empiezas a activar la verificación en dos pasos. */
  totpSecreto: string | null;
  totpActivo: boolean;
  totpUltimoPaso: number | null;
  /** Huellas de los códigos de respaldo que no has usado. */
  codigosRespaldo: string[];
}

const nuevoSello = () => randomBytes(16).toString("hex");

export async function leerCuenta(): Promise<Cuenta | null> {
  const { rows } = await getPool().query(
    `select hash, sello, totp_secreto, totp_activo, totp_ultimo_paso, codigos_respaldo from acceso where id = 1`,
  );
  const f = rows[0];
  if (!f) return null;
  return {
    hash: f.hash,
    sello: f.sello,
    totpSecreto: f.totp_secreto,
    totpActivo: f.totp_activo,
    totpUltimoPaso: f.totp_ultimo_paso === null ? null : Number(f.totp_ultimo_paso),
    codigosRespaldo: f.codigos_respaldo ?? [],
  };
}

/** Crea la cuenta si no existe (nadie puede «crear» una encima de la tuya). Devuelve el sello, o null si ya había. */
export async function crearCuenta(hash: string): Promise<string | null> {
  const sello = nuevoSello();
  const { rowCount } = await getPool().query(`insert into acceso (id, hash, sello) values (1, $1, $2) on conflict (id) do nothing`, [hash, sello]);
  return rowCount ? sello : null;
}

async function conSelloNuevo(sql: string, params: unknown[]): Promise<string> {
  const sello = nuevoSello();
  const { rowCount } = await getPool().query(sql, [sello, ...params]);
  if (!rowCount) throw new Error("No hay cuenta que actualizar.");
  return sello;
}

/** Contraseña nueva: cierra todas las demás sesiones y desconecta la extensión. */
export const cambiarHash = (hash: string) => conSelloNuevo(`update acceso set sello = $1, hash = $2, actualizado_en = now() where id = 1`, [hash]);

/** «Cerrar sesión en todos lados». */
export const renovarSello = () => conSelloNuevo(`update acceso set sello = $1, actualizado_en = now() where id = 1`, []);

/** Primer paso para activar la verificación: guarda el secreto (cifrado) pero todavía no lo exige. */
export async function guardarTotpPendiente(secretoCifrado: string): Promise<void> {
  await getPool().query(`update acceso set totp_secreto = $1, totp_activo = false, totp_ultimo_paso = null where id = 1 and not totp_activo`, [secretoCifrado]);
}

/** Ya probaste un código: desde ahora se exige. Cierra las demás sesiones. */
export const activarTotp = (paso: number, huellas: string[]) =>
  conSelloNuevo(
    `update acceso set sello = $1, totp_activo = true, totp_ultimo_paso = $2, codigos_respaldo = $3, actualizado_en = now()
      where id = 1 and totp_secreto is not null and not totp_activo`,
    [paso, huellas],
  );

export const desactivarTotp = () =>
  conSelloNuevo(
    `update acceso set sello = $1, totp_secreto = null, totp_activo = false, totp_ultimo_paso = null, codigos_respaldo = '{}', actualizado_en = now()
      where id = 1`,
    [],
  );

/**
 * Marca un código TOTP como usado. Es atómico: si dos peticiones traen el mismo código a la vez, solo una pasa.
 * Devuelve si se pudo (false = ya se había usado ese código o uno posterior).
 */
export async function usarPasoTotp(paso: number): Promise<boolean> {
  const { rowCount } = await getPool().query(
    `update acceso set totp_ultimo_paso = $1 where id = 1 and totp_activo and (totp_ultimo_paso is null or totp_ultimo_paso < $1)`,
    [paso],
  );
  return (rowCount ?? 0) > 0;
}

/** Gasta un código de respaldo (atómico). Devuelve cuántos quedan, o null si no era válido o ya se había usado. */
export async function gastarCodigoRespaldo(huella: string): Promise<number | null> {
  const { rows } = await getPool().query(
    `update acceso set codigos_respaldo = array_remove(codigos_respaldo, $1)
      where id = 1 and totp_activo and $1 = any(codigos_respaldo)
      returning cardinality(codigos_respaldo) as quedan`,
    [huella],
  );
  return rows[0] ? Number(rows[0].quedan) : null;
}

export async function reemplazarCodigosRespaldo(huellas: string[]): Promise<void> {
  await getPool().query(`update acceso set codigos_respaldo = $1 where id = 1 and totp_activo`, [huellas]);
}

/**
 * ¿El sello de este token sigue vigente? Se consulta en cada petición (una lectura por llave primaria): así cerrar
 * sesión en todos lados o cambiar la contraseña expulsa al instante en cualquier instancia.
 */
export async function selloVale(sello: string): Promise<boolean> {
  const { rows } = await getPool().query(`select sello from acceso where id = 1`);
  const actual = rows[0]?.sello as string | undefined;
  return !!actual && actual === sello;
}
