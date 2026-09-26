import { APP_STORAGE_PREFIX } from "@/config/app";
import { PERFIL_VACIO, sanitizarPerfil, type EstadoPerfil } from "@/core/perfil/perfil";
import { sanitizar, type Postulacion } from "@/core/seguimiento/seguimiento";
import { crearAlmacen } from "./almacen";

export interface EstadoLocalApp {
  perfil: EstadoPerfil;
  postulaciones: Postulacion[];
}

export const almacenPostulaciones = crearAlmacen<Postulacion[]>(`${APP_STORAGE_PREFIX}.postulaciones`, [], (x) => sanitizar(x).items);
export const almacenPerfil = crearAlmacen<EstadoPerfil>(`${APP_STORAGE_PREFIX}.perfil`, PERFIL_VACIO, sanitizarPerfil);

const legadoPostulaciones = crearAlmacen<Postulacion[]>("cenit.v1.postulaciones", [], (x) => sanitizar(x).items);
const legadoPerfil = crearAlmacen<EstadoPerfil>("cenit.v1.perfil", PERFIL_VACIO, sanitizarPerfil);

function vacio(estado: EstadoLocalApp): boolean {
  return estado.perfil.cvs.length === 0 && estado.postulaciones.length === 0;
}

export function leerEstadoLocal(): EstadoLocalApp {
  const actual = { perfil: almacenPerfil.leer(), postulaciones: almacenPostulaciones.leer() };
  return vacio(actual) ? { perfil: legadoPerfil.leer(), postulaciones: legadoPostulaciones.leer() } : actual;
}

export function guardarEstadoLocal(estado: EstadoLocalApp): void {
  almacenPerfil.escribir(estado.perfil);
  almacenPostulaciones.escribir(estado.postulaciones);
}

export function borrarEstadoLocal(): void {
  almacenPerfil.borrar();
  almacenPostulaciones.borrar();
  legadoPerfil.borrar();
  legadoPostulaciones.borrar();
}

