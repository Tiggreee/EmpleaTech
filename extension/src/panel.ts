/**
 * Lo que comparten los scripts de la extensión: hablar con el service worker y el panel (en shadow DOM).
 */
import type { Control } from "@/core/autollenado/dom";

export function mensaje<T>(msg: unknown): Promise<T> {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(msg, (r: { ok: boolean; datos?: T; error?: string } | undefined) => {
      if (chrome.runtime.lastError) return reject(new Error("La extensión se actualizó: recarga la página."));
      if (!r?.ok) return reject(new Error(r?.error ?? "Sin respuesta de EmpleaTech."));
      resolve(r.datos as T);
    });
  });
}

export const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c] as string);

// ---------------------------------------------------------------------------------------------------------------
// Panel (en shadow DOM para no mezclar estilos con la página)

const ESTILOS = `
  :host { all: initial; }
  .panel { position: fixed; right: 16px; bottom: 16px; z-index: 2147483647; width: 300px; max-height: 70vh; overflow: auto;
    font: 13px/1.45 system-ui, -apple-system, "Segoe UI", sans-serif; color: #0e0e0e; background: #f3f3ef; border: 3px solid #0e0e0e;
    box-shadow: 6px 6px 0 #0e0e0e; padding: 12px; }
  .fila { display: flex; align-items: center; justify-content: space-between; gap: 8px; border-bottom: 2px solid #0e0e0e; padding-bottom: 8px; }
  h2 { margin: 0; font: 800 14px/1 system-ui, sans-serif; letter-spacing: -0.02em; text-transform: uppercase; }
  h2::before { content: ""; display: inline-block; width: 9px; height: 9px; margin-right: 7px; background: #ff4f1a; }
  button { font: inherit; cursor: pointer; border: 2px solid #0e0e0e; background: #fff; color: #0e0e0e; padding: 6px 10px; }
  button:hover { background: #0e0e0e; color: #f3f3ef; }
  button:focus-visible { outline: 3px solid #0e0e0e; outline-offset: 2px; }
  button.principal { background: #ff4f1a; color: #0e0e0e; font-weight: 700; width: 100%; margin-top: 10px; }
  button.principal:hover { background: #0e0e0e; color: #f3f3ef; }
  .cerrar { border: 0; background: none; padding: 2px 6px; font-size: 16px; }
  p { margin: 8px 0 0; color: #4a4a46; }
  .ok { color: #1f6b36; font-weight: 600; }
  .error { color: #a3231a; font-weight: 600; }
  ul { margin: 6px 0 0; padding-left: 16px; }
  li button { border: 0; background: none; color: #b43a0b; padding: 0; text-align: left; text-decoration: underline; }
  li button:hover { background: none; color: #0e0e0e; }
`;

export class Panel {
  private readonly cuerpo: HTMLElement;

  constructor() {
    const host = document.createElement("div");
    host.id = "empleatech-panel";
    const raiz = host.attachShadow({ mode: "open" });
    raiz.innerHTML = `<style>${ESTILOS}</style>
      <section class="panel" role="dialog" aria-label="EmpleaTech">
        <div class="fila"><h2>EmpleaTech</h2><button class="cerrar" aria-label="Ocultar">×</button></div>
        <div id="cuerpo" aria-live="polite"></div>
      </section>`;
    this.cuerpo = raiz.getElementById("cuerpo") as HTMLElement;
    raiz.querySelector(".cerrar")?.addEventListener("click", () => host.remove());
    document.documentElement.appendChild(host);
  }

  mostrar(html: string) {
    this.cuerpo.innerHTML = html;
  }

  anteponer(html: string) {
    this.cuerpo.insertAdjacentHTML("afterbegin", html);
  }

  boton(texto: string, accion: () => void, principal = true) {
    const b = document.createElement("button");
    b.textContent = texto;
    if (principal) b.className = "principal";
    b.addEventListener("click", accion);
    this.cuerpo.appendChild(b);
  }

  faltantes(faltan: Control[]) {
    if (!faltan.length) return;
    const ul = document.createElement("ul");
    for (const f of faltan.slice(0, 12)) {
      const li = document.createElement("li");
      const b = document.createElement("button");
      b.textContent = f.etiqueta || "Campo sin nombre";
      b.addEventListener("click", () => {
        f.el.scrollIntoView({ block: "center", behavior: "smooth" });
        f.el.focus();
      });
      li.appendChild(b);
      ul.appendChild(li);
    }
    this.cuerpo.appendChild(ul);
  }
}
