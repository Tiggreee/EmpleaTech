/**
 * EmpleaTech en tu computadora sin comandos: base de datos → migraciones → build (si cambió el código) → respaldo
 * (si toca) → app en http://localhost:3000, visible solo para tu computadora. Si la app se cae, la vuelve a levantar,
 * y mientras corre respalda tu base una vez al día.
 *
 *   npm run arrancar                        en esta ventana (Ctrl+C para detener)
 *   npm run arrancar -- --segundo-plano     sin ventana; registros en <datos>/registros/app.log
 *   npm run detener                         detiene la que corre en segundo plano
 *   npm run estado                          dice si está corriendo y dónde están tus datos
 *   npm run inicio:instalar                 Windows: que arranque sola al iniciar sesión
 *   npm run inicio:quitar                   deshace lo anterior
 */
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs";
import net from "node:net";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import pg from "pg";
import { CONTENEDOR, RAIZ, carpetaDatos, cargarEntornoLocal, correr, urlDeBase } from "./entorno.mjs";
import { detenerProceso, esLanzador, listarProcesosNode, procesosDeEmpleaTech } from "./procesos.mjs";
import { respaldar } from "./respaldo.mjs";

cargarEntornoLocal();

const ESTE_SCRIPT = fileURLToPath(import.meta.url);
const HOST = "127.0.0.1";
const PUERTO = Number(process.env.EMPLEATECH_PUERTO || 3000);
const DATOS = carpetaDatos();
const REGISTRO = path.join(DATOS, "registros", "app.log");
const ARCHIVO_PID = path.join(DATOS, "app.pid");
// Carpeta de build propia (ver next.config.ts): los builds de desarrollo y pruebas usan .next y no la tocan.
const DIST = ".next-app";
const ENTORNO_APP = { ...process.env, EMPLEATECH_DIST_DIR: DIST };
const SELLO_BUILD = path.join(RAIZ, DIST, "empleatech-version.txt");
const NEXT = path.join(RAIZ, "node_modules", "next", "dist", "bin", "next");
const ACCESO_INICIO = path.join(process.env.APPDATA ?? "", "Microsoft", "Windows", "Start Menu", "Programs", "Startup", "EmpleaTech.lnk");
const MAX_REGISTRO = 5 * 1024 * 1024;
const HORA = 3_600_000;

const esperar = (ms) => new Promise((r) => setTimeout(r, ms));
const log = (msg) => console.log(`[${new Date().toLocaleString("es-MX")}] ${msg}`);

// ---------------------------------------------------------------------------------------------------------------
// Proceso único

function pidVivo(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (e) {
    return e.code === "EPERM";
  }
}

function leerPid() {
  try {
    const pid = Number(fs.readFileSync(ARCHIVO_PID, "utf8").trim());
    return Number.isInteger(pid) && pid > 0 ? pid : null;
  } catch {
    return null;
  }
}

/** Lanzadores de EmpleaTech vivos en esta carpeta (sin contar este proceso). */
function lanzadoresVivos() {
  const lista = listarProcesosNode();
  const deEmpleaTech = new Set(procesosDeEmpleaTech(lista, RAIZ, [process.pid]));
  return lista.filter((p) => deEmpleaTech.has(p.pid) && esLanzador(p.cmd, RAIZ)).map((p) => p.pid);
}

/**
 * El lanzador que está corriendo, confirmado por su línea de comando. Tras reiniciar, el número guardado puede ser
 * de otro programa (Windows recicla números): en ese caso se ignora y, si hay un lanzador real, se registra ese.
 */
function pidRegistrado() {
  const guardado = leerPid();
  const vivos = lanzadoresVivos();
  if (guardado && vivos.includes(guardado)) return guardado;
  const real = vivos[0] ?? null;
  if (real) fs.writeFileSync(ARCHIVO_PID, String(real));
  return real;
}

function detener() {
  // Todo lo de EmpleaTech en esta carpeta: el lanzador registrado y cualquier servidor que haya quedado suelto.
  const lista = listarProcesosNode();
  const pids = procesosDeEmpleaTech(lista, RAIZ, [process.pid]);
  if (!pids.length) {
    fs.rmSync(ARCHIVO_PID, { force: true });
    console.log("EmpleaTech no está corriendo.");
    return;
  }
  // El lanzador se cierra solo, nunca con su árbol: pudo haber abierto Docker Desktop y cerrarlo a la fuerza lo daña.
  // El servidor sí con sus hijos (sus propios procesos de Next).
  const cmdDe = (pid) => lista.find((p) => p.pid === pid)?.cmd ?? "";
  for (const pid of pids) if (pidVivo(pid)) detenerProceso(pid, { conHijos: !esLanzador(cmdDe(pid), RAIZ) });
  const siguen = pids.filter(pidVivo);
  fs.rmSync(ARCHIVO_PID, { force: true });
  if (siguen.length) {
    console.log(`No pude detener los procesos ${siguen.join(", ")}. Ciérralos desde el Administrador de tareas.`);
    process.exitCode = 1;
  } else console.log("EmpleaTech se detuvo.");
}

function estado() {
  const pids = procesosDeEmpleaTech(listarProcesosNode(), RAIZ, [process.pid]);
  const lanzador = pidRegistrado();
  console.log(pids.length ? `EmpleaTech está corriendo (lanzador ${lanzador ?? "sin registrar"}; procesos ${pids.join(", ")}).` : "EmpleaTech no está corriendo.");
  console.log(`Arranque al iniciar sesión: ${fs.existsSync(ACCESO_INICIO) ? "activado" : "desactivado"}.`);
  console.log(`Datos y registros: ${DATOS}`);
}

// ---------------------------------------------------------------------------------------------------------------
// Base de datos

async function baseResponde() {
  const cliente = new pg.Client({ connectionString: urlDeBase(), connectionTimeoutMillis: 3000 });
  try {
    await cliente.connect();
    await cliente.query("select 1");
    return true;
  } catch {
    return false;
  } finally {
    await cliente.end().catch(() => {});
  }
}

function rutaDockerDesktop() {
  const candidatos = [
    path.join(process.env.ProgramFiles || "C:\\Program Files", "Docker", "Docker", "Docker Desktop.exe"),
    path.join(process.env.LOCALAPPDATA || "", "Programs", "DockerDesktop", "Docker Desktop.exe"),
  ];
  return candidatos.find((c) => fs.existsSync(c));
}

// Con tiempo límite: si Docker está atorado, `docker info` puede quedarse esperando para siempre.
const dockerResponde = () => correr("docker", ["info"], { timeout: 15_000 }).ok;

const dockerDesktopAbierto = () =>
  process.platform === "win32" && /Docker Desktop\.exe/i.test(correr("tasklist", ["/FI", "IMAGENAME eq Docker Desktop.exe", "/FO", "CSV", "/NH"]).salida);

async function asegurarDocker() {
  if (dockerResponde()) return;
  if (dockerDesktopAbierto()) {
    // Al iniciar sesión Docker Desktop suele venir arrancando por su cuenta: solo hay que esperarlo.
    log("Docker Desktop está arrancando; lo espero…");
  } else if (process.platform === "win32") {
    const exe = rutaDockerDesktop();
    if (!exe) throw new Error("Docker no está corriendo y no encontré Docker Desktop. Ábrelo y vuelve a intentar.");
    log("Abriendo Docker Desktop…");
    // Con «start» Docker no queda como proceso hijo de EmpleaTech: detener EmpleaTech jamás debe cerrar Docker a la
    // fuerza (un cierre así deja sus archivos de conexión colgados y Docker ya no arranca).
    correr("cmd.exe", ["/d", "/c", "start", '""', `"${exe}"`], { windowsVerbatimArguments: true, timeout: 15_000 });
  } else if (process.platform === "darwin") {
    log("Abriendo Docker Desktop…");
    correr("open", ["-a", "Docker"]);
  }
  for (let i = 0; i < 60; i++) {
    await esperar(3000);
    if (dockerResponde()) return;
  }
  throw new Error("Docker no respondió en 3 minutos. Si Docker Desktop muestra un error, no elijas «Reset to factory defaults»: borra tus datos.");
}

async function asegurarBase() {
  if (await baseResponde()) return;
  await asegurarDocker();
  const existe = correr("docker", ["inspect", CONTENEDOR()], { timeout: 15_000 }).ok;
  log(existe ? "Encendiendo la base de datos…" : "Creando la base de datos por primera vez…");
  const r = existe ? correr("docker", ["start", CONTENEDOR()], { timeout: 60_000 }) : correr("docker", ["compose", "up", "-d"], { cwd: RAIZ, timeout: 300_000 });
  if (!r.ok) throw new Error(`No pude encender la base: ${r.error}`);
  for (let i = 0; i < 45; i++) {
    if (await baseResponde()) return;
    await esperar(2000);
  }
  throw new Error("La base de datos no respondió en 90 segundos.");
}

// ---------------------------------------------------------------------------------------------------------------
// App

function correrNode(args, env = process.env) {
  return new Promise((resolve, reject) => {
    const hijo = spawn(process.execPath, args, { cwd: RAIZ, stdio: "inherit", windowsHide: true, env });
    hijo.on("error", reject);
    hijo.on("close", (codigo) => (codigo === 0 ? resolve() : reject(new Error(`${path.basename(args[0])} ${args[1] ?? ""} terminó con código ${codigo}`))));
  });
}

/** Versión del código en disco: commit actual más los cambios sin guardar. Sin git, basta con que exista un build. */
function versionDelCodigo() {
  const head = correr("git", ["rev-parse", "HEAD"], { cwd: RAIZ });
  if (!head.ok) return "sin-git";
  const cambios = correr("git", ["status", "--porcelain"], { cwd: RAIZ }).salida + correr("git", ["diff", "HEAD"], { cwd: RAIZ, maxBuffer: 64 * 1024 * 1024 }).salida;
  return cambios ? `${head.salida}+${createHash("sha1").update(cambios).digest("hex").slice(0, 12)}` : head.salida;
}

async function construirSiHaceFalta() {
  const version = versionDelCodigo();
  const hayBuild = fs.existsSync(path.join(RAIZ, DIST, "BUILD_ID"));
  const anterior = fs.existsSync(SELLO_BUILD) ? fs.readFileSync(SELLO_BUILD, "utf8").trim() : "";
  if (hayBuild && (anterior === version || version === "sin-git")) return;
  log("El código cambió: preparando la app (tarda un par de minutos)…");
  await correrNode([NEXT, "build"], ENTORNO_APP);
  fs.writeFileSync(SELLO_BUILD, version);
}

function puertoOcupado() {
  return new Promise((resolve) => {
    const s = net.connect({ host: HOST, port: PUERTO });
    s.once("connect", () => (s.destroy(), resolve(true)));
    s.once("error", () => resolve(false));
  });
}

async function esEmpleaTech() {
  try {
    const r = await fetch(`http://${HOST}:${PUERTO}/api/aprendizaje`, { signal: AbortSignal.timeout(5000) });
    return r.ok;
  } catch {
    return false;
  }
}

async function respaldoSiToca() {
  try {
    const r = await respaldar({ siToca: true });
    if (!r.omitido) log(`Respaldo diario listo: ${path.basename(r.ruta)}`);
  } catch (e) {
    log(`No se pudo respaldar (se reintenta en una hora): ${e instanceof Error ? e.message : e}`);
  }
}

async function iniciar() {
  // Siempre queda constancia de cada arranque, también los automáticos al iniciar sesión.
  log(`Arranque (proceso ${process.pid}, lanzado por ${process.ppid}).`);
  const otro = pidRegistrado();
  if (otro) {
    log(`EmpleaTech ya está corriendo (proceso ${otro}).`);
    return;
  }
  if (await puertoOcupado()) {
    if (await esEmpleaTech()) log(`EmpleaTech ya responde en http://localhost:${PUERTO}.`);
    else log(`El puerto ${PUERTO} lo usa otro programa. Ciérralo o define EMPLEATECH_PUERTO en tu .env.`);
    return;
  }

  fs.mkdirSync(DATOS, { recursive: true });
  fs.writeFileSync(ARCHIVO_PID, String(process.pid));
  const limpiar = () => {
    if (leerPid() === process.pid) fs.rmSync(ARCHIVO_PID, { force: true });
  };
  process.on("exit", limpiar);

  await asegurarBase();
  await correrNode([path.join(RAIZ, "scripts", "migrate.mjs")]);
  await construirSiHaceFalta();
  await respaldoSiToca();
  setInterval(respaldoSiToca, HORA).unref();

  let servidor = null;
  let deteniendo = false;
  const caidas = [];
  const levantar = () => {
    servidor = spawn(process.execPath, [NEXT, "start", "-H", HOST, "-p", String(PUERTO)], {
      cwd: RAIZ,
      stdio: "inherit",
      windowsHide: true,
      env: { ...ENTORNO_APP, NODE_ENV: "production" },
    });
    servidor.on("exit", (codigo) => {
      if (deteniendo) return;
      const ahora = Date.now();
      caidas.push(ahora);
      while (caidas.length && ahora - caidas[0] > 10 * 60_000) caidas.shift();
      if (caidas.length > 5) {
        log(`La app se cayó ${caidas.length} veces en 10 minutos (último código ${codigo}); me detengo. Revisa este registro.`);
        process.exit(1);
      }
      log(`La app se detuvo (código ${codigo}); la levanto de nuevo en 5 s.`);
      setTimeout(levantar, 5000);
    });
  };
  const salir = () => {
    deteniendo = true;
    servidor?.kill();
    process.exit(0);
  };
  process.on("SIGINT", salir);
  process.on("SIGTERM", salir);

  levantar();
  for (let i = 0; i < 60; i++) {
    await esperar(1000);
    if (await esEmpleaTech()) {
      log(`Lista en http://localhost:${PUERTO} (solo tu computadora puede verla).`);
      return;
    }
  }
  log("La app tarda en responder; sigo intentando en segundo plano.");
}

// ---------------------------------------------------------------------------------------------------------------
// Segundo plano e inicio de sesión

function abrirRegistro() {
  fs.mkdirSync(path.dirname(REGISTRO), { recursive: true });
  if (fs.existsSync(REGISTRO) && fs.statSync(REGISTRO).size > MAX_REGISTRO) fs.renameSync(REGISTRO, `${REGISTRO}.1`);
  return fs.openSync(REGISTRO, "a");
}

function enSegundoPlano(args) {
  const fd = abrirRegistro();
  const hijo = spawn(process.execPath, [ESTE_SCRIPT, ...args], { cwd: RAIZ, detached: true, windowsHide: true, stdio: ["ignore", fd, fd] });
  hijo.unref();
  console.log(`EmpleaTech arranca en segundo plano. En un momento: http://localhost:${PUERTO}\nRegistros: ${REGISTRO}`);
}

function instalarInicio() {
  if (process.platform !== "win32") throw new Error("Por ahora el arranque al iniciar sesión solo está hecho para Windows.");
  // Los valores van por variables de entorno para que ninguna ruta con espacios o comillas rompa el comando.
  const ps = `$s = (New-Object -ComObject WScript.Shell).CreateShortcut($env:ET_ACCESO)
$s.TargetPath = $env:ET_NODE
$s.Arguments = '"' + $env:ET_SCRIPT + '" --segundo-plano'
$s.WorkingDirectory = $env:ET_RAIZ
$s.WindowStyle = 7
$s.Description = 'EmpleaTech'
$s.Save()`;
  const r = correr("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", ps], {
    env: { ...process.env, ET_ACCESO: ACCESO_INICIO, ET_NODE: process.execPath, ET_SCRIPT: ESTE_SCRIPT, ET_RAIZ: RAIZ },
  });
  if (!r.ok || !fs.existsSync(ACCESO_INICIO)) throw new Error(`No pude crear el acceso de inicio: ${r.error}`);
  console.log(`Listo: EmpleaTech arrancará sola cada vez que inicies sesión.\nPara quitarlo: npm run inicio:quitar`);
}

function quitarInicio() {
  const existia = fs.existsSync(ACCESO_INICIO);
  fs.rmSync(ACCESO_INICIO, { force: true });
  console.log(existia ? "Listo: EmpleaTech ya no arrancará sola al iniciar sesión." : "No estaba configurado el arranque automático.");
}

// ---------------------------------------------------------------------------------------------------------------

const argv = process.argv.slice(2);
try {
  if (argv.includes("--detener")) detener();
  else if (argv.includes("--estado")) estado();
  else if (argv.includes("--instalar-inicio")) instalarInicio();
  else if (argv.includes("--quitar-inicio")) quitarInicio();
  else if (argv.includes("--segundo-plano")) enSegundoPlano(argv.filter((a) => a !== "--segundo-plano"));
  else
    await iniciar().catch((e) => {
      log(`No pude arrancar EmpleaTech: ${e instanceof Error ? e.message : e}`);
      process.exit(1);
    });
} catch (e) {
  console.error(e instanceof Error ? e.message : e);
  process.exitCode = 1;
}
