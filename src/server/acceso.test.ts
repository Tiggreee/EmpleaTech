import { describe, expect, it } from "vitest";
import { hostPermitido, hostsExtra, rechazoDeAcceso, type SolicitudAcceso } from "./acceso";

const pedir = (s: Partial<SolicitudAcceso>): SolicitudAcceso => ({ metodo: "GET", host: "localhost:3000", origen: null, sitio: null, ...s });

describe("hostPermitido", () => {
  it("acepta los nombres de tu propia computadora, con o sin puerto", () => {
    for (const h of ["localhost", "localhost:3000", "127.0.0.1:3000", "[::1]:3000", "empleatech.localhost:3000", "LOCALHOST:3000"]) {
      expect(hostPermitido(h), h).toBe(true);
    }
  });

  it("rechaza IPs de la red y dominios que apuntan a tu IP (DNS rebinding)", () => {
    for (const h of ["192.168.1.20:3000", "0.0.0.0:3000", "evil.example:3000", "localhost.evil.example", "127.0.0.1.nip.io:3000", "", null]) {
      expect(hostPermitido(h), String(h)).toBe(false);
    }
  });

  it("admite hosts extra configurados, con o sin puerto", () => {
    const extra = hostsExtra(" Mi-PC.lan , otra:8080 ");
    expect(extra).toEqual(["mi-pc.lan", "otra:8080"]);
    expect(hostPermitido("mi-pc.lan:3000", extra)).toBe(true);
    expect(hostPermitido("otra:8080", extra)).toBe(true);
    expect(hostPermitido("otra:9090", extra)).toBe(false);
  });
});

describe("rechazoDeAcceso", () => {
  it("deja pasar lecturas y escrituras de la propia app", () => {
    expect(rechazoDeAcceso(pedir({}))).toBeNull();
    expect(rechazoDeAcceso(pedir({ metodo: "PUT", origen: "http://localhost:3000", sitio: "same-origin" }))).toBeNull();
  });

  it("deja pasar la extensión y las herramientas sin Origin (curl, scripts)", () => {
    expect(rechazoDeAcceso(pedir({ metodo: "POST", origen: "chrome-extension://abcdefghijklmnop", sitio: "none" }))).toBeNull();
    expect(rechazoDeAcceso(pedir({ metodo: "POST" }))).toBeNull();
  });

  it("bloquea que otra página dispare búsquedas o cambie datos", () => {
    const rechazos = [
      pedir({ metodo: "POST", origen: "https://sitio-malo.example", sitio: "cross-site" }),
      pedir({ metodo: "POST", origen: "http://localhost:4000" }), // otro puerto = otro origen
      pedir({ metodo: "DELETE", origen: "null" }),
      pedir({ metodo: "POST", sitio: "cross-site" }), // sin Origin, pero el navegador avisa que es cruzada
    ];
    for (const r of rechazos) expect(rechazoDeAcceso(r)?.status).toBe(403);
  });

  it("bloquea cualquier cosa que llegue con un Host ajeno, aunque sea lectura", () => {
    expect(rechazoDeAcceso(pedir({ host: "atacante.example:3000" }))?.status).toBe(403);
    expect(rechazoDeAcceso(pedir({ host: null }))?.status).toBe(403);
  });
});
