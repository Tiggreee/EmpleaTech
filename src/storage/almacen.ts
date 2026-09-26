/** Almacén local tipado sobre localStorage: sirve como caché del navegador y ayuda a migrar datos viejos. */
export interface Almacen<T> {
  readonly clave: string;
  suscribir(cb: () => void): () => void;
  leerCrudo(): string;
  leerCrudoServidor(): string;
  parsear(crudo: string): T;
  leer(): T;
  escribir(valor: T): boolean;
  borrar(): boolean;
}

export function crearAlmacen<T>(clave: string, vacio: T, sanear: (x: unknown) => T): Almacen<T> {
  const evento = `app:${clave}`;
  const crudoVacio = JSON.stringify(vacio);

  const parsear = (crudo: string): T => {
    try {
      return sanear(JSON.parse(crudo));
    } catch {
      return vacio;
    }
  };
  const leerCrudo = (): string => {
    try {
      return window.localStorage.getItem(clave) ?? crudoVacio;
    } catch {
      return crudoVacio;
    }
  };

  return {
    clave,
    suscribir(cb) {
      const enStorage = (e: StorageEvent) => {
        if (e.key === null || e.key === clave) cb();
      };
      window.addEventListener("storage", enStorage);
      window.addEventListener(evento, cb);
      return () => {
        window.removeEventListener("storage", enStorage);
        window.removeEventListener(evento, cb);
      };
    },
    leerCrudo,
    leerCrudoServidor: () => crudoVacio,
    parsear,
    leer: () => parsear(leerCrudo()),
    escribir(valor) {
      try {
        window.localStorage.setItem(clave, JSON.stringify(valor));
      } catch {
        return false;
      }
      window.dispatchEvent(new Event(evento));
      return true;
    },
    borrar() {
      try {
        window.localStorage.removeItem(clave);
      } catch {
        return false;
      }
      window.dispatchEvent(new Event(evento));
      return true;
    },
  };
}

