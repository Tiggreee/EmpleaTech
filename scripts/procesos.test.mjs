import { describe, expect, it } from "vitest";
import { esLanzador, procesosDeEmpleaTech } from "./procesos.mjs";

const RAIZ = "D:\\Proyectos\\EmpleaTech";
const NODE = '"C:\\Program Files\\nodejs\\node.exe"';

const LISTA = [
  { pid: 101, cmd: `${NODE} D:\\Proyectos\\EmpleaTech\\scripts\\arrancar.mjs` },
  { pid: 102, cmd: `${NODE} D:\\Proyectos\\EmpleaTech\\node_modules\\next\\dist\\bin\\next start -H 127.0.0.1 -p 3000` },
  { pid: 103, cmd: `${NODE} D:\\Proyectos\\EmpleaTech\\node_modules\\next\\dist\\bin\\next dev -H 127.0.0.1 -p 3100` },
  { pid: 104, cmd: `${NODE} D:\\Otra\\Copia\\scripts\\arrancar.mjs` },
  { pid: 105, cmd: `${NODE} D:\\Proyectos\\EmpleaTech\\scripts\\arrancar.mjs --detener` },
  { pid: 106, cmd: "C:\\Windows\\explorer.exe" },
  { pid: 107, cmd: `${NODE} C:\\Users\\ana\\AppData\\Local\\Programs\\Microsoft VS Code\\resources\\app\\extensions\\server.js` },
];

describe("procesos de EmpleaTech", () => {
  it("encuentra el lanzador y el servidor de esta carpeta, y nada más", () => {
    expect(procesosDeEmpleaTech(LISTA, RAIZ)).toEqual([101, 102]);
  });

  it("nunca toca el servidor de desarrollo, otra copia del proyecto, el comando de detener ni programas ajenos", () => {
    const encontrados = procesosDeEmpleaTech(LISTA, RAIZ);
    for (const pid of [103, 104, 105, 106, 107]) expect(encontrados).not.toContain(pid);
  });

  it("puede excluirse a sí mismo y no distingue mayúsculas ni tipo de diagonal en la ruta", () => {
    const lista = [{ pid: 201, cmd: `${NODE} d:/proyectos/empleatech/scripts/arrancar.mjs` }];
    expect(procesosDeEmpleaTech(lista, RAIZ)).toEqual([201]);
    expect(procesosDeEmpleaTech(lista, RAIZ, [201])).toEqual([]);
  });

  it("un número de proceso reciclado tras reiniciar no pasa por lanzador", () => {
    expect(esLanzador(LISTA[0].cmd, RAIZ)).toBe(true);
    expect(esLanzador(LISTA[5].cmd, RAIZ)).toBe(false);
    expect(esLanzador(LISTA[3].cmd, RAIZ)).toBe(false);
  });
});
