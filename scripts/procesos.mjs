/**
 * Encontrar y detener los procesos de EmpleaTech sin equivocarse de proceso. Tras reiniciar la computadora, el
 * número de proceso guardado puede pertenecer ya a otro programa: antes de cerrar algo se confirma, por su línea de
 * comando, que de verdad es EmpleaTech de esta carpeta.
 */
import path from "node:path";
import process from "node:process";
import { correr } from "./entorno.mjs";

/** Procesos de Node con su línea de comando: [{ pid, cmd }]. */
export function listarProcesosNode() {
  if (process.platform === "win32") {
    const ps = `Get-CimInstance Win32_Process -Filter "Name='node.exe'" | ForEach-Object { "$($_.ProcessId)\`t$($_.CommandLine)" }`;
    const r = correr("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", ps]);
    return r.ok ? leerLista(r.salida, "\t") : [];
  }
  const r = correr("ps", ["-eo", "pid=,args="]);
  return r.ok ? leerLista(r.salida, " ") : [];
}

function leerLista(salida, separador) {
  return salida
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => {
      const i = l.indexOf(separador);
      return { pid: Number(i > 0 ? l.slice(0, i) : l), cmd: i > 0 ? l.slice(i + 1).trim() : "" };
    })
    .filter((p) => Number.isInteger(p.pid) && p.pid > 0);
}

const normalizar = (s) => s.replace(/\\/g, "/").toLowerCase();

/**
 * De una lista de procesos, los de EmpleaTech en `raiz`: el lanzador (arrancar.mjs) y el servidor (`next start`).
 * Nunca el servidor de desarrollo (`next dev`) ni los comandos de consulta o de detener.
 */
export function procesosDeEmpleaTech(lista, raiz, excluir = []) {
  const base = normalizar(path.resolve(raiz));
  return lista
    .filter(({ pid, cmd }) => {
      if (excluir.includes(pid)) return false;
      const c = normalizar(cmd);
      if (!c.includes(base)) return false;
      if (/--(detener|estado|instalar-inicio|quitar-inicio)\b/.test(c)) return false;
      return c.includes("scripts/arrancar.mjs") || /\/next\/dist\/bin\/next["']?\s+start\b/.test(c);
    })
    .map((p) => p.pid);
}

export const esLanzador = (cmd, raiz) => normalizar(cmd).includes(`${normalizar(path.resolve(raiz))}/scripts/arrancar.mjs`);

/**
 * Cierra un proceso. `conHijos` solo para el servidor de Next: el lanzador pudo haber abierto Docker Desktop y cerrar
 * su árbol se lo llevaría entre las patas.
 */
export function detenerProceso(pid, { conHijos = false } = {}) {
  if (process.platform === "win32") return correr("taskkill", ["/PID", String(pid), ...(conHijos ? ["/T"] : []), "/F"]).ok;
  try {
    process.kill(pid, "SIGTERM");
    return true;
  } catch {
    return false;
  }
}
