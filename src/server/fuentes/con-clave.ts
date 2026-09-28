import { INFO_FUENTES, type Consulta, type ContextoFuente, type FuenteVacantes } from "@/core/vacantes/fuentes";
import { paisesDeTexto } from "@/core/vacantes/paises";
import { crearVacante, fechaIso, htmlATexto, modalidadDeTexto, salarioDeTexto, type Vacante } from "@/core/vacantes/vacante";
import { arr, definidas, num, obj, str } from "./json";

const consultaTexto = (c: Consulta) => c.palabras.slice(0, 3).join(" ");

// ---------------------------------------------------------------------------------------------------------------
// Adzuna — https://developer.adzuna.com (clave gratuita: ADZUNA_APP_ID y ADZUNA_APP_KEY)

const PAISES_ADZUNA = ["mx", "br", "us", "ca", "gb", "es", "de", "fr", "it", "nl", "pl", "at", "ch", "be", "au", "nz", "in", "sg", "za"];

export function paisAdzuna(c: Consulta): string {
  return c.paises.map((p) => p.toLowerCase()).find((p) => PAISES_ADZUNA.includes(p)) ?? "mx";
}

export function mapearAdzuna(json: unknown, pais: string): Vacante[] {
  return definidas(
    arr(obj(json).results).map((x) => {
      const j = obj(x);
      const lugar = str(obj(j.location).display_name);
      const texto = str(j.description) ?? "";
      return crearVacante("adzuna", {
        idExterno: str(j.id) ?? "",
        titulo: htmlATexto(str(j.title) ?? ""),
        empresa: str(obj(j.company).display_name) ?? "",
        ubicacion: lugar,
        modalidad: modalidadDeTexto(`${str(j.title) ?? ""} ${lugar ?? ""} ${texto}`),
        paises: [pais.toUpperCase()],
        url: str(j.redirect_url) ?? "",
        descripcion: htmlATexto(texto),
        publicadaEn: fechaIso(str(j.created)),
        salario: num(j.salary_min) || num(j.salary_max) ? { min: num(j.salary_min), max: num(j.salary_max), periodo: "año" } : undefined,
        etiquetas: [str(obj(j.category).label), str(j.contract_time)].filter((e): e is string => !!e),
      });
    }),
  );
}

export const adzuna: FuenteVacantes = {
  info: INFO_FUENTES.adzuna,
  async buscar(c: Consulta, ctx: ContextoFuente) {
    const pais = paisAdzuna(c);
    const q = new URLSearchParams({
      app_id: ctx.claves.ADZUNA_APP_ID ?? "",
      app_key: ctx.claves.ADZUNA_APP_KEY ?? "",
      what_or: c.palabras.slice(0, 5).join(" "),
      results_per_page: "50",
      "content-type": "application/json",
    });
    return mapearAdzuna(await ctx.http.json(`https://api.adzuna.com/v1/api/jobs/${pais}/search/1?${q}`), pais);
  },
};

// ---------------------------------------------------------------------------------------------------------------
// Jooble — https://jooble.org/api/about (clave gratuita: JOOBLE_API_KEY)

export function mapearJooble(json: unknown): Vacante[] {
  return definidas(
    arr(obj(json).jobs).map((x) => {
      const j = obj(x);
      const lugar = str(j.location);
      return crearVacante("jooble", {
        idExterno: str(j.id) ?? "",
        titulo: htmlATexto(str(j.title) ?? ""),
        empresa: str(j.company) ?? "",
        ubicacion: lugar,
        modalidad: modalidadDeTexto(`${str(j.title) ?? ""} ${lugar ?? ""} ${str(j.type) ?? ""}`),
        paises: paisesDeTexto(lugar).paises,
        url: str(j.link) ?? "",
        descripcion: htmlATexto(str(j.snippet) ?? ""),
        publicadaEn: fechaIso(str(j.updated)),
        salario: salarioDeTexto(str(j.salary)),
        etiquetas: [str(j.type), str(j.source)].filter((e): e is string => !!e),
      });
    }),
  );
}

export const jooble: FuenteVacantes = {
  info: INFO_FUENTES.jooble,
  async buscar(c, ctx) {
    const clave = encodeURIComponent(ctx.claves.JOOBLE_API_KEY ?? "");
    const json = await ctx.http.json(`https://jooble.org/api/${clave}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ keywords: consultaTexto(c), location: c.soloRemoto ? "remote" : "", page: "1" }),
    });
    return mapearJooble(json);
  },
};

// ---------------------------------------------------------------------------------------------------------------
// USAJOBS — https://developer.usajobs.gov (clave gratuita: USAJOBS_API_KEY y el correo registrado en USAJOBS_EMAIL)

const PERIODO_USAJOBS: Record<string, "hora" | "mes" | "año"> = { PA: "año", PH: "hora", PM: "mes" };

export function mapearUsaJobs(json: unknown): Vacante[] {
  const items = arr(obj(obj(json).SearchResult).SearchResultItems);
  return definidas(
    items.map((x) => {
      const d = obj(obj(x).MatchedObjectDescriptor);
      const pago = obj(arr(d.PositionRemuneration)[0]);
      const detalles = obj(obj(d.UserArea).Details);
      const lugar = str(d.PositionLocationDisplay);
      const min = num(pago.MinimumRange);
      const max = num(pago.MaximumRange);
      return crearVacante("usajobs", {
        idExterno: str(d.PositionID) ?? str(obj(x).MatchedObjectId) ?? "",
        titulo: str(d.PositionTitle) ?? "",
        empresa: str(d.OrganizationName) ?? str(d.DepartmentName) ?? "",
        ubicacion: lugar,
        modalidad: detalles.RemoteIndicator === true ? "remoto" : (modalidadDeTexto(lugar) ?? "presencial"),
        paises: ["US"],
        url: str(d.PositionURI) ?? "",
        urlPostular: str(arr(d.ApplyURI)[0]),
        descripcion: [str(d.QualificationSummary), str(detalles.JobSummary)].filter(Boolean).join("\n\n"),
        publicadaEn: fechaIso(str(d.PublicationStartDate)),
        salario: min || max ? { min, max, moneda: "USD", periodo: PERIODO_USAJOBS[str(pago.RateIntervalCode) ?? ""] } : undefined,
        etiquetas: arr(d.JobCategory).map((cat) => str(obj(cat).Name)).filter((e): e is string => !!e),
      });
    }),
  );
}

export const usaJobs: FuenteVacantes = {
  info: INFO_FUENTES.usajobs,
  async buscar(c, ctx) {
    const q = new URLSearchParams({ Keyword: consultaTexto(c), ResultsPerPage: "100" });
    if (c.soloRemoto) q.set("RemoteIndicator", "True");
    const json = await ctx.http.json(`https://data.usajobs.gov/api/search?${q}`, {
      headers: { "Authorization-Key": ctx.claves.USAJOBS_API_KEY ?? "", "User-Agent": ctx.claves.USAJOBS_EMAIL ?? "" },
    });
    return mapearUsaJobs(json);
  },
};
