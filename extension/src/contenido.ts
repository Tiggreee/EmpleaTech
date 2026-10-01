/**
 * Panel de EmpleaTech sobre los formularios de Greenhouse, Lever y Ashby. Llena lo que sabe, marca lo que falta y,
 * cuando tú envías, registra la postulación y aprende tus respuestas. Nunca presiona «Enviar».
 */
import type { DatosAutollenado } from "@/core/autollenado/campos";
import { capturarRespuestas, escanear, llenarFormulario, parecePostulacionEnviada, verificar } from "@/core/autollenado/dom";
import { Panel, esc, mensaje } from "./panel";

interface Archivo {
  nombre: string;
  tipo: string;
  base64: string;
}
interface Respuesta {
  datos: DatosAutollenado;
  vacante?: { titulo: string; empresa: string };
  archivos: { cv?: Archivo; carta?: Archivo };
}

const PENDIENTE = "empleatech-envio";
const MIN_CAMPOS = 3;

function aArchivo(a: Archivo | undefined): File | undefined {
  if (!a) return undefined;
  const bytes = Uint8Array.from(atob(a.base64), (c) => c.charCodeAt(0));
  return new File([bytes], a.nombre, { type: a.tipo });
}

// ---------------------------------------------------------------------------------------------------------------
// Flujo

let panel: Panel | null = null;
let vigilando = false;
let ultimoEnvio = 0;

function revisar(p: Panel, llenados: number) {
  const faltan = verificar(document);
  const resumen = faltan.length
    ? `Te falta${faltan.length === 1 ? "" : "n"} ${faltan.length} obligatorio${faltan.length === 1 ? "" : "s"} (marcados en rojo):`
    : "Todo lo obligatorio está listo. Revisa y presiona «Enviar» tú.";
  p.mostrar(`<p class="${faltan.length ? "" : "ok"}">${llenados ? `Llené ${llenados} campo${llenados === 1 ? "" : "s"}. ` : ""}${resumen}</p>`);
  p.faltantes(faltan);
  p.boton("Volver a revisar", () => revisar(p, 0), false);
}

async function llenar(p: Panel) {
  p.mostrar(`<p>Preparando tus datos…</p>`);
  try {
    const r = await mensaje<Respuesta>({ tipo: "datos", url: location.href });
    const res = llenarFormulario(document, r.datos, { cv: aArchivo(r.archivos.cv), carta: aArchivo(r.archivos.carta) });
    revisar(p, res.filter((x) => x.estado === "llenado").length);
    if (r.vacante) p.anteponer(`<p>Para <strong>${esc(r.vacante.titulo)}</strong> en ${esc(r.vacante.empresa)}.</p>`);
    vigilarEnvio(p);
  } catch (e) {
    p.mostrar(`<p class="error">${esc(e instanceof Error ? e.message : "No se pudo llenar.")}</p>`);
    p.boton("Intentar de nuevo", () => void llenar(p));
  }
}

async function avisarEnvio(url: string) {
  sessionStorage.removeItem(PENDIENTE);
  try {
    const r = await mensaje<{ registrada: boolean; empresa: string; puesto: string }>({ tipo: "evento", cuerpo: { tipo: "enviada", url, titulo: document.title } });
    panel ??= new Panel();
    panel.mostrar(`<p class="ok">${r.registrada ? `Registrada en tu tracker: ${esc(r.puesto)} en ${esc(r.empresa)}.` : "Esta postulación ya estaba registrada."}</p>`);
  } catch {
    // Si la app no responde, se registra a mano con «Ya la envié» en Hoy.
  }
}

/** Cuando presionas «Enviar»: aprende tus respuestas y espera la confirmación del ATS para registrar la postulación. */
function vigilarEnvio(p: Panel) {
  if (vigilando) return;
  vigilando = true;
  const alEnviar = () => {
    if (Date.now() - ultimoEnvio < 3000) return; // el clic y el submit llegan juntos
    ultimoEnvio = Date.now();
    const items = capturarRespuestas(document);
    if (items.length) void mensaje({ tipo: "evento", cuerpo: { tipo: "aprendizaje", items } }).catch(() => undefined);
    const url = location.href;
    sessionStorage.setItem(PENDIENTE, JSON.stringify({ url, t: Date.now() }));
    let intentos = 0;
    const reloj = setInterval(() => {
      if (parecePostulacionEnviada(location.href, document.body?.innerText ?? "")) {
        clearInterval(reloj);
        void avisarEnvio(url);
      } else if (++intentos > 30) clearInterval(reloj);
    }, 1000);
    p.mostrar(`<p>Enviando… en cuanto el sitio confirme, la registramos en tu tracker.</p>`);
  };
  document.addEventListener("submit", alEnviar, true);
  document.addEventListener(
    "click",
    (e) => {
      const b = (e.target as HTMLElement | null)?.closest("button, input[type='submit']") as HTMLElement | null;
      if (!b || b.closest("#empleatech-panel")) return;
      const etiqueta = (b.textContent || (b as HTMLInputElement).value || "").trim();
      if (b.getAttribute("type") === "submit" || /^(submit|send|apply|enviar|postular|aplicar)\b/i.test(etiqueta)) alEnviar();
    },
    true,
  );
}

function iniciar() {
  // Si llegamos a la página de confirmación después de enviar, registrar la postulación.
  const pendiente = sessionStorage.getItem(PENDIENTE);
  if (pendiente) {
    try {
      const { url, t } = JSON.parse(pendiente) as { url: string; t: number };
      if (Date.now() - t < 5 * 60_000 && parecePostulacionEnviada(location.href, document.body?.innerText ?? "")) {
        void avisarEnvio(url);
        return;
      }
    } catch {
      sessionStorage.removeItem(PENDIENTE);
    }
  }
  if (panel || escanear(document).length < MIN_CAMPOS) return;
  panel = new Panel();
  const p = panel;
  p.mostrar(`<p>Llenamos este formulario con tu perfil, tu CV y tu carta para esta vacante. Tú revisas y envías.</p>`);
  p.boton("Llenar con EmpleaTech", () => void llenar(p));
}

// Los formularios de Ashby (y algunos de Greenhouse) se dibujan después de cargar: esperar a que aparezcan.
iniciar();
if (!panel) {
  const obs = new MutationObserver(() => {
    iniciar();
    if (panel) obs.disconnect();
  });
  obs.observe(document.documentElement, { childList: true, subtree: true });
  setTimeout(() => obs.disconnect(), 20_000);
}
