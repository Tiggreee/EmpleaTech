import { describe, expect, it } from "vitest";
import { MAX_FALLOS, ipDeCliente, minutosDeEspera, trasFallo, type Intentos } from "./intentos";

const T = Date.UTC(2026, 9, 1, 12);
const MIN = 60_000;

function fallar(veces: number, desde?: Intentos, ahora = T): Intentos | undefined {
  let i = desde;
  for (let n = 0; n < veces; n++) i = trasFallo(i, ahora);
  return i;
}

describe("límite de intentos", () => {
  it("deja 5 intentos y luego bloquea 15 minutos", () => {
    const cuatro = fallar(MAX_FALLOS - 1);
    expect(minutosDeEspera(cuatro, T)).toBe(0);
    const cinco = trasFallo(cuatro, T);
    expect(minutosDeEspera(cinco, T)).toBe(15);
    expect(minutosDeEspera(cinco, T + 15 * MIN)).toBe(0);
    expect(minutosDeEspera(undefined, T)).toBe(0);
  });

  it("cada bloqueo seguido dura el doble, hasta un día", () => {
    let i: Intentos | undefined;
    let ahora = T;
    const duraciones: number[] = [];
    for (let b = 0; b < 9; b++) {
      i = fallar(MAX_FALLOS, i, ahora);
      duraciones.push(minutosDeEspera(i, ahora));
      ahora = (i as Intentos).hasta;
    }
    expect(duraciones).toEqual([15, 30, 60, 120, 240, 480, 960, 1440, 1440]);
  });

  it("un día sin fallos olvida el historial", () => {
    const bloqueado = fallar(MAX_FALLOS);
    const despues = (bloqueado as Intentos).hasta + 24 * 3600_000 + 1;
    const nuevo = trasFallo(bloqueado, despues);
    expect(nuevo).toEqual({ fallos: 1, bloqueos: 0, hasta: 0, ultimo: despues });
  });
});

describe("de dónde viene la petición", () => {
  const h = (o: Record<string, string>) => new Headers(o);

  it("en Vercel usa la IP que pone su red", () => {
    expect(ipDeCliente(h({ "x-real-ip": "203.0.113.7", "x-forwarded-for": "203.0.113.7" }), { VERCEL: "1" })).toBe("203.0.113.7");
    expect(ipDeCliente(h({ "x-forwarded-for": "203.0.113.8, 10.0.0.1" }), { VERCEL: "1" })).toBe("203.0.113.8");
    expect(ipDeCliente(h({}), { VERCEL: "1" })).toBe("desconocido");
  });

  it("fuera de Vercel no cree en encabezados que cualquiera puede inventar", () => {
    expect(ipDeCliente(h({ "x-forwarded-for": "1.2.3.4" }), {})).toBe("directo");
    expect(ipDeCliente(h({ "x-real-ip": "5.6.7.8" }), {})).toBe("directo");
  });
});
