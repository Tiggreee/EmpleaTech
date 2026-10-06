import { clasificar, elegirOpcion, idiomaDelFormulario, normalizarEtiqueta, valorTexto, type Campo, type DatosAutollenado, type IdiomaForm } from "./campos";

type Tipo = "texto" | "area" | "numero" | "fecha" | "select" | "radio" | "checkbox" | "archivo" | "combobox";

export interface Control {
  el: HTMLElement;
  tipo: Tipo;
  etiqueta: string;
  nombre: string;
  requerido: boolean;
  campo: Campo | null;
  /** Radios y selects: texto de cada opción y el elemento que la activa. */
  opciones: { texto: string; el: HTMLElement }[];
}

export type EstadoCampo = "llenado" | "ya-tenia" | "pendiente";

export interface ResultadoCampo {
  etiqueta: string;
  campo: Campo | null;
  estado: EstadoCampo;
  requerido: boolean;
}

export interface Archivos {
  cv?: File;
  carta?: File;
}

// ---------------------------------------------------------------------------------------------------------------
// Lectura del formulario

const texto = (el: Element | null | undefined) => (el?.textContent ?? "").replace(/\s+/g, " ").trim();
const limpiar = (s: string) => s.replace(/[*✱]/g, "").replace(/\s+/g, " ").trim().slice(0, 200);
const escapar = (s: string) => s.replace(/(["\\])/g, "\\$1");
const IGNORAR = /captcha|recaptcha|hcaptcha/i;
const ETIQUETAS_SELECTOR = "legend, label, .application-label, [class*='label'], [class*='Label']";

function labelFor(el: HTMLElement): Element | null {
  return el.id ? el.ownerDocument.querySelector(`label[for="${escapar(el.id)}"]`) : null;
}

/** Primera etiqueta dentro de `nodo` que no envuelve controles (así no toma la etiqueta de una opción). */
function etiquetaDeContenedor(nodo: Element, excepto?: Element): Element | null {
  for (const l of Array.from(nodo.querySelectorAll(ETIQUETAS_SELECTOR))) {
    if (excepto && l.contains(excepto)) continue;
    if (l.querySelector("input, select, textarea")) continue;
    if (texto(l)) return l;
  }
  return null;
}

/** Texto de la pregunta de un campo: <label for>, aria-labelledby, <label> contenedora o la etiqueta más cercana. */
export function etiquetaDe(el: HTMLElement): string {
  const doc = el.ownerDocument;
  const ids = el.getAttribute("aria-labelledby");
  if (ids) {
    const t = ids.split(/\s+/).map((id) => texto(doc.getElementById(id))).join(" ");
    if (t.trim()) return limpiar(t);
  }
  const lf = labelFor(el);
  if (texto(lf)) return limpiar(texto(lf));
  const tipo = el.getAttribute("type");
  const envolvente = el.closest("label");
  if (envolvente && tipo !== "radio" && tipo !== "checkbox" && texto(envolvente)) return limpiar(texto(envolvente));
  const aria = el.getAttribute("aria-label");
  if (aria?.trim()) return limpiar(aria);
  // Sube hasta 5 niveles buscando la etiqueta de la pregunta (Lever: .application-label; otros: legend, label).
  // Se detiene al llegar a un contenedor con otros campos: su etiqueta sería de otra pregunta.
  let nodo: HTMLElement | null = el.parentElement;
  for (let i = 0; nodo && i < 5; i++, nodo = nodo.parentElement) {
    if (nodo.querySelectorAll("input:not([type='hidden']), select, textarea").length > 1) break;
    const l = etiquetaDeContenedor(nodo, el);
    if (l) return limpiar(texto(l));
  }
  return limpiar(el.getAttribute("placeholder") ?? el.getAttribute("name") ?? "");
}

/** Texto crudo de la etiqueta (con su asterisco), para saber si el campo es obligatorio. */
function etiquetaCruda(el: HTMLElement): string {
  const lf = labelFor(el);
  if (lf) return lf.textContent ?? "";
  const q = el.closest("li, fieldset, .field, .application-question, [class*='field'], [class*='Field']");
  return (q && etiquetaDeContenedor(q, el)?.textContent) ?? "";
}

/** Texto de una zona para soltar archivos («Drag & drop file or Browse»): no dice qué archivo pide. */
const ZONA_ARCHIVO = /^(drag|drop|arrastra|suelta|browse|choose|select|selecciona|upload|sube|attach|adjunta)\b/i;

/**
 * La pregunta de un campo de archivo cuya etiqueta es la de su zona para soltar: el texto del contenedor que ya dice
 * qué archivo es («Include your resume»), sin pasar a uno que tenga otros campos.
 */
function preguntaDeArchivo(el: HTMLElement, generica: string): string {
  let nodo: HTMLElement | null = el.parentElement;
  for (let i = 0; nodo && i < 6; i++, nodo = nodo.parentElement) {
    if (nodo.querySelectorAll("input:not([type='hidden']), select, textarea").length > 1) break;
    const t = limpiar(texto(nodo).replace(generica, " "));
    if (t && clasificar(t, {})) return t;
  }
  return generica;
}

function esRequerido(el: HTMLElement): boolean {
  return (el as HTMLInputElement).required || el.getAttribute("aria-required") === "true" || /[*✱]/.test(etiquetaCruda(el));
}

/**
 * La pregunta de un grupo de radios/casillas está en el contenedor de todas sus opciones, no en la etiqueta de cada
 * una. Sube hasta encontrarla sin pasar a un contenedor que ya incluya campos de otra pregunta.
 */
function preguntaDeGrupo(grupo: HTMLInputElement[]): Element | null {
  let nodo: HTMLElement | null = grupo[0].parentElement;
  while (nodo && !grupo.every((g) => nodo?.contains(g))) nodo = nodo.parentElement;
  for (let i = 0; nodo && i < 4; i++, nodo = nodo.parentElement) {
    const ajenos = Array.from(nodo.querySelectorAll("input:not([type='hidden']), select, textarea")).filter((x) => !grupo.includes(x as HTMLInputElement));
    if (ajenos.length) break;
    const l = etiquetaDeContenedor(nodo);
    if (l) return l;
  }
  return null;
}

function opcionDeRadio(input: HTMLInputElement): string {
  return texto(labelFor(input)) || texto(input.closest("label")) || input.value;
}

/** Todos los campos del formulario, con su pregunta, si son obligatorios y qué dato les toca. */
export function escanear(raiz: ParentNode): Control[] {
  const controles: Control[] = [];
  const gruposVistos = new Set<string>();
  for (const el of Array.from(raiz.querySelectorAll<HTMLElement>("input, textarea, select"))) {
    const tipoAttr = (el.getAttribute("type") ?? "").toLowerCase();
    const nombre = el.getAttribute("name") ?? el.id ?? "";
    if (tipoAttr === "hidden" || tipoAttr === "submit" || tipoAttr === "button" || (el as HTMLInputElement).disabled) continue;
    if (IGNORAR.test(nombre) || IGNORAR.test(el.id)) continue;

    if (tipoAttr === "radio" || tipoAttr === "checkbox") {
      const clave = `${tipoAttr}:${nombre}`;
      if (!nombre || gruposVistos.has(clave)) continue;
      gruposVistos.add(clave);
      const grupo = Array.from(raiz.querySelectorAll<HTMLInputElement>(`input[type="${tipoAttr}"][name="${escapar(nombre)}"]`));
      const l = preguntaDeGrupo(grupo);
      const cruda = l?.textContent ?? "";
      const pregunta = limpiar(cruda) || etiquetaDe(grupo[0]);
      controles.push({
        el: grupo[0],
        tipo: tipoAttr,
        etiqueta: pregunta,
        nombre,
        requerido: grupo.some((g) => g.required) || /[*✱]/.test(cruda),
        campo: clasificar(pregunta, { nombre }),
        opciones: grupo.map((g) => ({ texto: opcionDeRadio(g), el: g })),
      });
      continue;
    }

    const propia = etiquetaDe(el);
    const etiqueta = tipoAttr === "file" && ZONA_ARCHIVO.test(propia) ? preguntaDeArchivo(el, propia) : propia;
    const tag = el.tagName.toLowerCase();
    const tipo: Tipo =
      tag === "select" ? "select"
      : tag === "textarea" ? "area"
      : tipoAttr === "file" ? "archivo"
      : el.getAttribute("role") === "combobox" ? "combobox"
      : tipoAttr === "number" ? "numero"
      : tipoAttr === "date" ? "fecha"
      : "texto";
    controles.push({
      el,
      tipo,
      etiqueta,
      nombre,
      requerido: esRequerido(el),
      campo: clasificar(etiqueta, { nombre, tipo: tipoAttr }),
      opciones:
        tipo === "select"
          ? Array.from((el as HTMLSelectElement).options)
              .filter((o) => o.value !== "")
              .map((o) => ({ texto: o.text.trim(), el: o as unknown as HTMLElement }))
          : [],
    });
  }
  return controles;
}

// ---------------------------------------------------------------------------------------------------------------
// Escritura compatible con React (los tres ATS usan componentes controlados)

function avisar(el: HTMLElement) {
  el.dispatchEvent(new Event("input", { bubbles: true }));
  el.dispatchEvent(new Event("change", { bubbles: true }));
  el.dispatchEvent(new Event("blur", { bubbles: true }));
}

export function asignarValor(el: HTMLElement, valor: string) {
  const vista = el.ownerDocument.defaultView as (Window & typeof globalThis) | null;
  const proto = el.tagName === "TEXTAREA" ? vista?.HTMLTextAreaElement.prototype : el.tagName === "SELECT" ? vista?.HTMLSelectElement.prototype : vista?.HTMLInputElement.prototype;
  const setter = proto ? Object.getOwnPropertyDescriptor(proto, "value")?.set : undefined;
  if (setter) setter.call(el, valor);
  else (el as HTMLInputElement).value = valor;
  avisar(el);
}

function tieneValor(c: Control): boolean {
  if (c.tipo === "radio" || c.tipo === "checkbox") return c.opciones.some((o) => (o.el as HTMLInputElement).checked);
  if (c.tipo === "archivo") return ((c.el as HTMLInputElement).files?.length ?? 0) > 0;
  return ((c.el as HTMLInputElement).value ?? "").trim() !== "";
}

function adjuntar(input: HTMLInputElement, archivo: File): boolean {
  try {
    const vista = input.ownerDocument.defaultView as (Window & typeof globalThis) | null;
    const DT = vista?.DataTransfer ?? (globalThis as { DataTransfer?: typeof DataTransfer }).DataTransfer;
    if (!DT) return false;
    const dt = new DT();
    dt.items.add(archivo);
    input.files = dt.files;
    avisar(input);
    return (input.files?.length ?? 0) > 0;
  } catch {
    return false;
  }
}

function llenarControl(c: Control, d: DatosAutollenado, archivos: Archivos, idioma: IdiomaForm, hoy: Date): boolean {
  switch (c.tipo) {
    case "archivo": {
      const archivo = c.campo === "cv" ? archivos.cv : c.campo === "carta" ? archivos.carta : undefined;
      return archivo ? adjuntar(c.el as HTMLInputElement, archivo) : false;
    }
    case "select": {
      const i = elegirOpcion(c.campo, d, c.etiqueta, c.opciones.map((o) => o.texto));
      if (i < 0) return false;
      asignarValor(c.el, (c.opciones[i].el as unknown as HTMLOptionElement).value);
      return true;
    }
    case "radio": {
      const i = elegirOpcion(c.campo, d, c.etiqueta, c.opciones.map((o) => o.texto));
      if (i < 0) return false;
      (c.opciones[i].el as HTMLInputElement).click();
      return (c.opciones[i].el as HTMLInputElement).checked;
    }
    case "checkbox":
    case "combobox":
      // Casillas (a menudo aceptar términos) y listas desplegables a la medida quedan siempre para ti.
      return false;
    default: {
      const aprendida = d.aprendidas[normalizarEtiqueta(c.etiqueta)];
      let v = aprendida ?? (c.campo ? valorTexto(c.campo, d, idioma, hoy) : undefined);
      if (v === undefined) return false;
      if (c.tipo === "numero") v = v.replace(/[^\d.]/g, "");
      if (c.tipo === "fecha" && !/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
      if (!v) return false;
      asignarValor(c.el, v);
      return true;
    }
  }
}

/**
 * Llena lo que sabe y deja lo demás marcado. Nunca toca un campo que ya tiene valor, nunca marca casillas de términos
 * y nunca envía: el botón «Enviar» es siempre tuyo.
 */
export function llenarFormulario(raiz: ParentNode, d: DatosAutollenado, archivos: Archivos, hoy = new Date()): ResultadoCampo[] {
  const controles = escanear(raiz);
  const idioma = idiomaDelFormulario(controles.map((c) => c.etiqueta));
  return controles.map((c) => {
    const base = { etiqueta: c.etiqueta, campo: c.campo, requerido: c.requerido };
    if (tieneValor(c)) return { ...base, estado: "ya-tenia" as const };
    return { ...base, estado: llenarControl(c, d, archivos, idioma, hoy) ? ("llenado" as const) : ("pendiente" as const) };
  });
}

// ---------------------------------------------------------------------------------------------------------------
// Verificación antes de enviar

export const MARCA_FALTA = "data-empleatech-falta";

/** Relee el formulario: los obligatorios vacíos se marcan en la página y se devuelven para mostrarlos. */
export function verificar(raiz: ParentNode): Control[] {
  const faltan: Control[] = [];
  for (const c of escanear(raiz)) {
    const marcar = c.tipo === "radio" || c.tipo === "checkbox" ? ((c.el.closest("fieldset, li, [role='radiogroup']") as HTMLElement | null) ?? c.el) : c.el;
    if (c.requerido && !tieneValor(c)) {
      marcar.setAttribute(MARCA_FALTA, "1");
      marcar.style.outline = "2px solid #fb7185";
      marcar.style.outlineOffset = "2px";
      faltan.push(c);
    } else if (marcar.hasAttribute(MARCA_FALTA)) {
      marcar.removeAttribute(MARCA_FALTA);
      marcar.style.outline = "";
    }
  }
  return faltan;
}

// ---------------------------------------------------------------------------------------------------------------
// Aprender de tus correcciones y detectar el envío

const DATOS_PERSONALES = new Set<Campo>(["nombreCompleto", "nombre", "apellido", "nombrePreferido", "correo", "telefono", "cv", "carta"]);

/**
 * Lo que respondiste a mano en preguntas que no reconocimos (o corregiste), para usarlo la próxima vez.
 * No guarda datos personales ni archivos: esos ya viven en tu perfil.
 */
export function capturarRespuestas(raiz: ParentNode): { clave: string; etiqueta: string; valor: string }[] {
  const out: { clave: string; etiqueta: string; valor: string }[] = [];
  for (const c of escanear(raiz)) {
    if (c.tipo === "archivo" || (c.campo && DATOS_PERSONALES.has(c.campo))) continue;
    let valor = "";
    if (c.tipo === "radio") valor = c.opciones.find((o) => (o.el as HTMLInputElement).checked)?.texto ?? "";
    else if (c.tipo === "select") {
      const s = c.el as HTMLSelectElement;
      valor = s.selectedIndex >= 0 && s.value ? s.options[s.selectedIndex].text.trim() : "";
    } else if (c.tipo !== "checkbox" && c.tipo !== "combobox") valor = ((c.el as HTMLInputElement).value ?? "").trim();
    const clave = normalizarEtiqueta(c.etiqueta);
    if (valor && clave.length >= 4) out.push({ clave, etiqueta: c.etiqueta, valor: valor.slice(0, 2000) });
  }
  return out;
}

const EXITO_URL = /(\/thanks|\/thank-you|confirmation|\/submitted|application_confirmation|\/success)/i;
const EXITO_TEXTO = /(thank you for (applying|your application)|thanks for applying|application (has been |was )?(received|submitted)|we.?ve received your application|gracias por (tu )?(postulaci|aplicar|tu solicitud)|hemos recibido tu (postulaci|solicitud|aplicaci))/i;

/** ¿La página dice que la postulación se envió? (cambia de URL o muestra un mensaje de confirmación). */
export function parecePostulacionEnviada(url: string, textoPagina: string): boolean {
  return EXITO_URL.test(url) || EXITO_TEXTO.test(textoPagina.slice(0, 20_000));
}
