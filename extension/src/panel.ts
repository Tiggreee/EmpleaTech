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
    font: 13px/1.45 system-ui, -apple-system, "Segoe UI", sans-serif; color: #eaf0ff; background: #0b1020; border: 1px solid #2a3558;
    border-radius: 14px; box-shadow: 0 12px 32px rgba(0,0,0,.35); padding: 12px; }
  .fila { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
  h2 { margin: 0; font-size: 14px; }
  button { font: inherit; cursor: pointer; border-radius: 10px; border: 1px solid #2a3558; background: #141b33; color: #eaf0ff; padding: 6px 10px; }
  button.principal { background: linear-gradient(100deg, #22d3ee, #8b5cf6); color: #05070f; border: 0; font-weight: 700; width: 100%; margin-top: 10px; }
  .cerrar { border: 0; background: none; padding: 2px 6px; font-size: 16px; }
  p { margin: 8px 0 0; color: #9aa7c7; }
  .ok { color: #34d399; }
  .error { color: #fb7185; }
  ul { margin: 6px 0 0; padding-left: 16px; }
  li button { border: 0; background: none; color: #fbbf24; padding: 0; text-align: left; text-decoration: underline; }
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
