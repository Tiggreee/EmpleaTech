import { coincidePalabras, palabraClave } from "@/core/vacantes/busqueda";
import { INFO_FUENTES, type Consulta, type FuenteVacantes } from "@/core/vacantes/fuentes";
import { paisesDeTexto } from "@/core/vacantes/paises";
import { crearVacante, fechaIso, htmlATexto, modalidadDeTexto, type SalarioVacante, type Vacante } from "@/core/vacantes/vacante";
import { arr, definidas, num, obj, str } from "./json";

/** Por debajo de esto (en USD) suelen ser trabajos de un par de horas que no compensan la propuesta. */
export const PRESUPUESTO_MINIMO_USD = { proyecto: 100, hora: 10 } as const;

/** Palabra más específica de cada búsqueda, sin repetir: las plataformas freelance buscan por habilidad. */
function clavesDeBusqueda(c: Consulta): string[] {
  return [...new Set(c.palabras.map(palabraClave).filter((k): k is string => !!k))].slice(0, 3);
}

// ---------------------------------------------------------------------------------------------------------------
// Freelancer.com — https://developers.freelancer.com (proyectos activos, lectura pública)

export function mapearFreelancer(json: unknown): Vacante[] {
  return definidas(
    arr(obj(obj(json).result).projects).map((x) => {
      const p = obj(x);
      if (p.deleted === true || p.nonpublic === true) return undefined;
      const moneda = obj(p.currency);
      const codigo = str(moneda.code);
      const tasa = num(moneda.exchange_rate) ?? (codigo === "USD" ? 1 : undefined);
      const presupuesto = obj(p.budget);
      const min = num(presupuesto.minimum);
      const max = num(presupuesto.maximum);
      const porHora = str(p.type) === "hourly";
      const tope = max ?? min;
      if (tasa !== undefined && tope !== undefined && tope * tasa < (porHora ? PRESUPUESTO_MINIMO_USD.hora : PRESUPUESTO_MINIMO_USD.proyecto)) return undefined;

      const pais = str(obj(obj(p.location).country).name);
      const local = p.local === true;
      const seo = str(p.seo_url);
      return crearVacante("freelancer", {
        idExterno: str(p.id) ?? "",
        titulo: str(p.title) ?? "",
        // Freelancer.com no publica el nombre del cliente.
        empresa: pais ? `Cliente en ${pais}` : "Cliente de Freelancer.com",
        ubicacion: local && pais ? pais : "Remoto",
        modalidad: local ? "presencial" : "remoto",
        paises: local && pais ? paisesDeTexto(pais).paises : [],
        url: seo ? `https://www.freelancer.com/projects/${seo}` : "",
        descripcion: str(p.description) ?? str(p.preview_description) ?? "",
        publicadaEn: fechaIso(num(p.time_submitted) ?? num(p.submitdate)),
        salario: min || max ? { min, max, moneda: codigo, periodo: porHora ? "hora" : "proyecto" } : undefined,
        etiquetas: arr(p.jobs)
          .map((j) => str(obj(j).name))
          .filter((s): s is string => !!s),
        tipo: "proyecto",
        propuestas: num(obj(p.bid_stats).bid_count),
      });
    }),
  );
}

export const freelancer: FuenteVacantes = {
  info: INFO_FUENTES.freelancer,
  async buscar(c, ctx) {
    const claves = clavesDeBusqueda(c);
    const lotes = await Promise.all(
      (claves.length ? claves : [""]).map((q) => {
        const params = new URLSearchParams({ query: q, limit: "50", full_description: "true", job_details: "true", compact: "true", sort_field: "time_updated" });
        params.append("languages[]", "en");
        params.append("languages[]", "es");
        return ctx.http.json(`https://www.freelancer.com/api/projects/0.1/projects/active/?${params}`);
      }),
    );
    return lotes.flatMap(mapearFreelancer);
  },
};

// ---------------------------------------------------------------------------------------------------------------
// Braintrust — https://app.usebraintrust.com/api/jobs/ (lista pública; el detalle trae la descripción)

const PERIODO_BRAINTRUST: Record<string, SalarioVacante["periodo"]> = { hourly: "hora", fixed: "proyecto", monthly: "mes", annual: "año", yearly: "año" };
const MAX_DETALLES = 20;

export function mapearBraintrust(item: unknown, detalle?: unknown): Vacante | undefined {
  const j = obj(item);
  const d = obj(detalle);
  const id = str(j.id);
  if (!id || !/^\d+$/.test(id)) return undefined;
  const titulo = str(j.title) ?? "";
  const lugares = arr(j.locations)
    .map((l) => str(obj(l).location))
    .filter((s): s is string => !!s);
  return crearVacante("braintrust", {
    idExterno: id,
    titulo,
    empresa: str(obj(j.employer).name) ?? "",
    ubicacion: lugares.join(", ") || "Remoto",
    modalidad: modalidadDeTexto(titulo) ?? "remoto",
    paises: paisesDeTexto(lugares.join(", ")).paises,
    url: `https://app.usebraintrust.com/jobs/${id}/`,
    descripcion: htmlATexto([str(d.introduction), str(d.description), str(d.requirements)].filter(Boolean).join("\n")),
    publicadaEn: fechaIso(str(j.created)),
    salario: { min: num(j.budget_minimum_usd), max: num(j.budget_maximum_usd), moneda: "USD", periodo: PERIODO_BRAINTRUST[str(j.payment_type) ?? ""] },
    etiquetas: [...arr(j.main_skills).map((s) => str(obj(s).name)), str(obj(j.role).name)].filter((s): s is string => !!s),
    // También publican contrataciones directas: esas son empleos, no proyectos.
    tipo: str(j.job_type) === "freelance" ? "proyecto" : undefined,
  });
}

export const braintrust: FuenteVacantes = {
  info: INFO_FUENTES.braintrust,
  async buscar(c, ctx) {
    // Todo lo abierto cabe en una página; su robots.txt pide no paginar con ?page=.
    const lista = arr(obj(await ctx.http.json("https://app.usebraintrust.com/api/jobs/?page_size=100")).results);
    // Solo se pide el detalle (una consulta por proyecto) de los que coinciden con lo que buscas.
    const candidatas = lista.filter((x) => {
      const v = mapearBraintrust(x);
      return v && coincidePalabras(v, c.palabras);
    });
    const elegidas = candidatas.slice(0, MAX_DETALLES);
    const detalles = await Promise.allSettled(elegidas.map((x) => ctx.http.json(`https://app.usebraintrust.com/api/jobs/${str(obj(x).id)}/`)));
    return definidas(elegidas.map((x, i) => mapearBraintrust(x, detalles[i].status === "fulfilled" ? detalles[i].value : undefined)));
  },
};
