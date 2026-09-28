import type { Vacante } from "@/core/vacantes/vacante";

/** Lectores tolerantes para JSON de APIs externas: nunca confían en la forma de la respuesta. */
export type Obj = Record<string, unknown>;

export const obj = (x: unknown): Obj => (typeof x === "object" && x !== null && !Array.isArray(x) ? (x as Obj) : {});
export const arr = (x: unknown): unknown[] => (Array.isArray(x) ? x : []);
export const str = (x: unknown): string | undefined => (typeof x === "string" && x.trim() ? x : typeof x === "number" && Number.isFinite(x) ? String(x) : undefined);
export const num = (x: unknown): number | undefined =>
  typeof x === "number" && Number.isFinite(x) ? x : typeof x === "string" && x.trim() && Number.isFinite(Number(x)) ? Number(x) : undefined;
export const strs = (x: unknown): string[] => arr(x).map(str).filter((s): s is string => !!s);
export const definidas = (xs: (Vacante | undefined)[]): Vacante[] => xs.filter((v): v is Vacante => !!v);

/** «acme-labs» → «Acme Labs» para las fuentes que solo dan el identificador del tablero. */
export function nombreDeTablero(token: string): string {
  return token.replace(/[-_]+/g, " ").replace(/\b\p{L}/gu, (c) => c.toUpperCase()).trim();
}
