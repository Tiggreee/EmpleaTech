/**
 * Panel de EmpleaTech en Workana, Upwork y Freelancer.com: arma la propuesta para el proyecto que tienes abierto y la
 * pone en su cuadro. Solo cuando tú lo pides; nunca envía nada.
 */
import { campoDePropuesta, esPaginaDeProyecto, leerProyecto, llenarPropuesta } from "@/core/autollenado/propuesta";
import { Panel, esc, mensaje } from "./panel";

interface Propuesta {
  titulo: string;
  propuesta: string;
  brechas: string[];
}

let panel: Panel | null = null;
let paginaDelPanel = "";

async function armar(p: Panel) {
  p.mostrar("<p>Leyendo el proyecto y armando tu propuesta…</p>");
  try {
    const { titulo, texto } = leerProyecto(document);
    const r = await mensaje<Propuesta>({ tipo: "evento", cuerpo: { tipo: "propuesta", url: location.href, titulo, texto } });
    const campo = campoDePropuesta(document);
    const estado = campo ? llenarPropuesta(campo, r.propuesta) : null;
    const aviso =
      estado === "llenado"
        ? `<p class="ok">Puse tu propuesta en el cuadro. Revísala, ajústala si quieres y envíala tú.</p>`
        : estado === "ya-tenia"
          ? "<p>El cuadro ya tenía texto: no lo toqué. Copia la propuesta si prefieres usarla.</p>"
          : "<p>Esta página no tiene el cuadro de la propuesta: cópiala y pégala al abrir el formulario.</p>";
    const brechas = r.brechas.length ? `<p>Pide y no está en tu CV: ${esc(r.brechas.join(", "))}.</p>` : "";
    p.mostrar(`<p>Para <strong>${esc(r.titulo)}</strong>.</p>${aviso}${brechas}`);
    p.boton("Copiar propuesta", () => void navigator.clipboard.writeText(r.propuesta), false);
    p.boton(
      "Ya la envié",
      () =>
        void mensaje<{ registrada: boolean }>({ tipo: "evento", cuerpo: { tipo: "enviada", url: location.href, titulo: r.titulo } })
          .then((x) => p.mostrar(`<p class="ok">${x.registrada ? "Registrada en tu tracker." : "Ya estaba registrada en tu tracker."}</p>`))
          .catch((e: unknown) => p.mostrar(`<p class="error">${esc(e instanceof Error ? e.message : "No se pudo registrar.")}</p>`)),
      false,
    );
  } catch (e) {
    p.mostrar(`<p class="error">${esc(e instanceof Error ? e.message : "No se pudo armar la propuesta.")}</p>`);
    p.boton("Intentar de nuevo", () => void armar(p));
  }
}

/** Muestra el panel en páginas de proyecto. Upwork y Workana cambian de página sin recargar: se revisa la URL. */
function revisarPagina() {
  if (!esPaginaDeProyecto(location.href)) return;
  if (panel && paginaDelPanel === location.href && document.getElementById("empleatech-panel")) return;
  document.getElementById("empleatech-panel")?.remove();
  panel = new Panel();
  paginaDelPanel = location.href;
  const p = panel;
  p.mostrar("<p>Armamos tu propuesta para este proyecto con tu CV: tu evidencia real, sin tu correo ni teléfono. Tú la revisas y la envías.</p>");
  p.boton("Armar propuesta con EmpleaTech", () => void armar(p));
}

revisarPagina();
setInterval(revisarPagina, 1500);
