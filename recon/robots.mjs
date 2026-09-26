// Parser de robots.txt (RFC 9309): grupos por user-agent, comodines * y $, gana la regla más larga; Allow gana empates.

export function parseRobots(texto) {
  const grupos = [];
  let actual = null;
  let leyendoAgentes = false;
  for (const bruta of texto.split(/\r?\n/)) {
    const linea = bruta.replace(/#.*$/, "").trim();
    if (!linea) continue;
    const i = linea.indexOf(":");
    if (i < 0) continue;
    const campo = linea.slice(0, i).trim().toLowerCase();
    const valor = linea.slice(i + 1).trim();
    if (campo === "user-agent") {
      if (!leyendoAgentes || !actual) {
        actual = { agentes: [], reglas: [] };
        grupos.push(actual);
      }
      actual.agentes.push(valor.toLowerCase());
      leyendoAgentes = true;
    } else if (campo === "allow" || campo === "disallow") {
      leyendoAgentes = false;
      if (actual && valor !== "") actual.reglas.push({ permitir: campo === "allow", patron: valor });
    } else {
      leyendoAgentes = false;
    }
  }
  return grupos;
}

function aRegex(patron) {
  const fin = patron.endsWith("$");
  const cuerpo = (fin ? patron.slice(0, -1) : patron).replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*");
  return new RegExp(`^${cuerpo}${fin ? "$" : ""}`);
}

function elegirGrupo(grupos, agente) {
  const a = agente.toLowerCase();
  let mejor = null;
  let largo = -1;
  for (const g of grupos) {
    for (const nombre of g.agentes) {
      if (nombre === "*") continue;
      if (a.includes(nombre) && nombre.length > largo) {
        mejor = g;
        largo = nombre.length;
      }
    }
  }
  return mejor ?? grupos.find((g) => g.agentes.includes("*")) ?? null;
}

/** ¿Puede `agente` pedir `ruta` (path + query)? Sin reglas aplicables => permitido. */
export function permitido(grupos, agente, ruta) {
  const g = elegirGrupo(grupos, agente);
  if (!g) return true;
  let mejor = null;
  for (const r of g.reglas) {
    if (!aRegex(r.patron).test(ruta)) continue;
    if (!mejor || r.patron.length > mejor.patron.length || (r.patron.length === mejor.patron.length && r.permitir)) mejor = r;
  }
  return mejor ? mejor.permitir : true;
}
