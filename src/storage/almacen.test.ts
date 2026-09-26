import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { crearAlmacen } from "./almacen";

class FakeStorage {
  datos = new Map<string, string>();
  fallar: "ninguno" | "escribir" | "todo" = "ninguno";
  getItem(k: string) {
    if (this.fallar === "todo") throw new Error("bloqueado");
    return this.datos.get(k) ?? null;
  }
  setItem(k: string, v: string) {
    if (this.fallar !== "ninguno") throw new Error("QuotaExceededError");
    this.datos.set(k, v);
  }
  removeItem(k: string) {
    if (this.fallar === "todo") throw new Error("bloqueado");
    this.datos.delete(k);
  }
}

let almacenamiento: FakeStorage;
let ventana: EventTarget & { localStorage: FakeStorage };

beforeEach(() => {
  almacenamiento = new FakeStorage();
  ventana = Object.assign(new EventTarget(), { localStorage: almacenamiento });
  vi.stubGlobal("window", ventana);
  vi.stubGlobal("Event", Event);
});
afterEach(() => vi.unstubAllGlobals());

const numeros = () => crearAlmacen<number[]>("k", [], (x) => (Array.isArray(x) ? x.filter((n): n is number => typeof n === "number") : []));

describe("crearAlmacen", () => {
  it("lee el vacío cuando no hay nada y sanea lo corrupto", () => {
    const a = numeros();
    expect(a.leer()).toEqual([]);
    almacenamiento.datos.set("k", "{no json");
    expect(a.leer()).toEqual([]);
    almacenamiento.datos.set("k", JSON.stringify([1, "x", null, 3]));
    expect(a.leer()).toEqual([1, 3]);
  });

  it("escribe, notifica a los suscriptores y permite darse de baja", () => {
    const a = numeros();
    const cb = vi.fn();
    const baja = a.suscribir(cb);
    expect(a.escribir([1, 2])).toBe(true);
    expect(cb).toHaveBeenCalledTimes(1);
    expect(a.leer()).toEqual([1, 2]);
    baja();
    a.escribir([3]);
    expect(cb).toHaveBeenCalledTimes(1);
  });

  it("el snapshot crudo es estable mientras no cambien los datos (requisito de useSyncExternalStore)", () => {
    const a = numeros();
    a.escribir([1]);
    expect(a.leerCrudo()).toBe(a.leerCrudo());
  });

  it("si el navegador bloquea la escritura devuelve false y no notifica", () => {
    const a = numeros();
    const cb = vi.fn();
    a.suscribir(cb);
    almacenamiento.fallar = "escribir";
    expect(a.escribir([1])).toBe(false);
    expect(cb).not.toHaveBeenCalled();
  });

  it("si el almacenamiento está totalmente bloqueado, leer no revienta", () => {
    const a = numeros();
    almacenamiento.fallar = "todo";
    expect(a.leer()).toEqual([]);
    expect(a.borrar()).toBe(false);
  });

  it("borrar vuelve al estado vacío y notifica", () => {
    const a = numeros();
    a.escribir([9]);
    const cb = vi.fn();
    a.suscribir(cb);
    expect(a.borrar()).toBe(true);
    expect(a.leer()).toEqual([]);
    expect(cb).toHaveBeenCalled();
  });

  it("los cambios de otra pestaña (evento storage) notifican solo para su clave", () => {
    const a = numeros();
    const cb = vi.fn();
    a.suscribir(cb);
    ventana.dispatchEvent(Object.assign(new Event("storage"), { key: "otra" }));
    expect(cb).not.toHaveBeenCalled();
    ventana.dispatchEvent(Object.assign(new Event("storage"), { key: "k" }));
    expect(cb).toHaveBeenCalledTimes(1);
  });

  it("el servidor siempre ve el estado vacío (evita hidratación distinta)", () => {
    const a = crearAlmacen<{ v: number }>("z", { v: 0 }, (x) => x as { v: number });
    a.escribir({ v: 5 });
    expect(a.leerCrudoServidor()).toBe('{"v":0}');
  });
});
