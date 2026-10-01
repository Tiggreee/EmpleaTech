/**
 * Qué tan adivinable es una contraseña. La misma regla corre en el navegador (para guiarte mientras escribes) y en
 * el servidor (que es el que decide): saltarse la pantalla no sirve para guardar una débil.
 *
 * No exige mayúsculas ni símbolos: una frase larga es más fuerte y más fácil de recordar. Lo que rechaza es lo que
 * un atacante prueba primero: palabras comunes, secuencias de teclado y patrones repetidos.
 */

export const MIN_CONTRASENA = 12;
export const MAX_CONTRASENA = 200;

export type NivelFuerza = 0 | 1 | 2 | 3 | 4;

export interface FuerzaContrasena {
  valida: boolean;
  /** 0 muy débil … 4 muy fuerte. */
  nivel: NivelFuerza;
  /** Qué falta, en el orden en que conviene arreglarlo. Vacío si es válida. */
  problemas: string[];
}

export const NOMBRE_NIVEL: Record<NivelFuerza, string> = { 0: "Muy débil", 1: "Débil", 2: "Aceptable", 3: "Fuerte", 4: "Muy fuerte" };

/** Lo primero que se prueba en un ataque por diccionario (ya sin acentos y en minúsculas). */
const COMUNES = [
  "password", "contrasena", "contrasenia", "clave", "secreto", "qwerty", "asdfgh", "zxcvbn", "azerty",
  "admin", "administrador", "root", "login", "welcome", "bienvenido", "letmein", "iloveyou", "teamo", "monkey",
  "dragon", "master", "sunshine", "princess", "football", "futbol", "superman", "batman", "pokemon", "starwars",
  "mexico", "america", "chivas", "empleatech", "empleatec", "trabajo", "empleo", "usuario", "user", "test", "prueba",
  "abc123", "changeme", "default", "hola", "hello", "amor", "love",
];

const FILAS_TECLADO = ["1234567890", "qwertyuiop", "asdfghjkl", "zxcvbnm", "abcdefghijklmnopqrstuvwxyz"];

/** «P@ssw0rd» y «password» son la misma para un diccionario con sustituciones. */
const SUSTITUCIONES: Record<string, string> = { "0": "o", "1": "i", "3": "e", "4": "a", "5": "s", "7": "t", "@": "a", $: "s", "!": "i" };

function normalizar(c: string): string {
  return c
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

const sinSustituciones = (c: string) => [...c].map((ch) => SUSTITUCIONES[ch] ?? ch).join("");
const compactar = (c: string) => normalizar(c).replace(/[\s._-]+/g, "");

/** ¿b sigue a a en alguna fila del teclado o en el abecedario (en cualquier sentido)? */
function consecutivas(a: string, b: string): boolean {
  if (a === b) return true;
  return FILAS_TECLADO.some((fila) => {
    const i = fila.indexOf(a);
    return i >= 0 && (fila[i + 1] === b || fila[i - 1] === b);
  });
}

/**
 * Caracteres que de verdad aportan: los que no repiten ni continúan una secuencia («aaaa», «1234», «qwer» cuentan
 * como uno). Así «123456789012» vale lo que vale: casi nada.
 */
function largoEfectivo(c: string): number {
  let n = 0;
  for (let i = 0; i < c.length; i++) if (i === 0 || !consecutivas(c[i - 1], c[i])) n++;
  return n;
}

function tamanoAlfabeto(c: string): number {
  let t = 0;
  if (/[a-z]/.test(c)) t += 26;
  if (/[A-Z]/.test(c)) t += 26;
  if (/\d/.test(c)) t += 10;
  if (/[^a-zA-Z\d]/.test(c)) t += 33;
  return Math.max(t, 10);
}

/**
 * `extras`: palabras que también cuentan como obvias en esta instalación (por ejemplo, el dominio). Se comparan sin
 * acentos ni mayúsculas.
 */
export function evaluarContrasena(contrasena: string, extras: string[] = []): FuerzaContrasena {
  const problemas: string[] = [];
  const c = contrasena.normalize("NFKC");
  if (c.length < MIN_CONTRASENA) problemas.push(`Usa al menos ${MIN_CONTRASENA} caracteres (llevas ${c.length}).`);
  if (c.length > MAX_CONTRASENA) problemas.push(`Usa como máximo ${MAX_CONTRASENA} caracteres.`);

  const compacto = compactar(c);
  if (new Set(compacto).size < 5) problemas.push("Tiene muy pocos caracteres distintos.");
  else if (/^(.{1,6}?)\1+$/.test(compacto)) problemas.push("Es un mismo pedazo repetido; usa una frase.");

  // Quita las palabras comunes y mira cuánto queda que un atacante no adivine a la primera. Se buscan con las
  // sustituciones deshechas, pero las secuencias se cuentan sobre lo que escribiste («1234» no es «iz3a»).
  const obvias = [...COMUNES, ...extras.map((e) => sinSustituciones(compactar(e))).filter((e) => e.length >= 4)].sort((a, b) => b.length - a.length);
  const diccionario = sinSustituciones(compacto);
  const tapada = new Array<boolean>(compacto.length).fill(false);
  for (const w of obvias) {
    for (let i = diccionario.indexOf(w); i >= 0; i = diccionario.indexOf(w, i + w.length)) tapada.fill(true, i, i + w.length);
  }
  let restoEfectivo = 0;
  let tramo = "";
  for (let i = 0; i <= compacto.length; i++) {
    if (i < compacto.length && !tapada[i]) tramo += compacto[i];
    else {
      restoEfectivo += largoEfectivo(tramo);
      tramo = "";
    }
  }
  const efectivo = largoEfectivo(compacto);

  if (problemas.length === 0) {
    if (efectivo < 8) problemas.push("Evita secuencias como 123456, abcdef o qwerty.");
    else if (restoEfectivo < 8) problemas.push("Se basa en una palabra muy común; agrega palabras tuyas.");
  }

  // Estimación gruesa de bits: lo que aporta cada carácter útil según el alfabeto que usa.
  const bits = Math.min(efectivo, restoEfectivo + 2) * Math.log2(tamanoAlfabeto(c));
  const valida = problemas.length === 0;
  const nivel: NivelFuerza = !valida ? (bits >= 40 ? 1 : 0) : bits < 60 ? 2 : bits < 80 ? 3 : 4;
  return { valida, nivel, problemas };
}
