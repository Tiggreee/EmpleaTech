import type { ContextoFuente, FuenteDeEmpresas, FuenteVacantes, Http } from "@/core/vacantes/fuentes";
import type { FuenteId } from "@/core/vacantes/vacante";
import { arbeitnow, getOnBoard, himalayas, jobicy, remoteOk, remotive } from "./agregadores";
import { adzuna, jooble, usaJobs } from "./con-clave";
import { ashby, greenhouse, lever } from "./empresas";
import { braintrust, freelancer } from "./freelance";

export const ADAPTADORES: Record<FuenteId, FuenteVacantes> = {
  getonboard: getOnBoard,
  remotive,
  remoteok: remoteOk,
  jobicy,
  himalayas,
  arbeitnow,
  greenhouse,
  lever,
  ashby,
  adzuna,
  jooble,
  usajobs: usaJobs,
  freelancer,
  braintrust,
};

/** Tableros verificados (con vacantes publicadas) para empezar; el usuario puede cambiarlos. */
export const EMPRESAS_INICIALES: Record<FuenteDeEmpresas, string[]> = {
  greenhouse: ["wizeline", "gitlab", "cloudflare", "stripe", "twilio", "elastic", "mongodb", "okta", "databricks", "airbnb"],
  lever: ["toptal", "spotify", "palantir"],
  ashby: ["supabase", "posthog", "zapier", "linear", "notion", "ramp"],
};

const CLAVES = ["ADZUNA_APP_ID", "ADZUNA_APP_KEY", "JOOBLE_API_KEY", "USAJOBS_API_KEY", "USAJOBS_EMAIL"] as const;

export function clavesDelEntorno(): Record<string, string | undefined> {
  return Object.fromEntries(CLAVES.map((k) => [k, process.env[k]?.trim() || undefined]));
}

const MAX_BYTES = 15 * 1024 * 1024;

/** Cliente HTTP real: tiempo límite, tope de tamaño y errores con el código de respuesta. */
export function httpReal(timeoutMs = 15_000): Http {
  return {
    async json(url, init) {
      const res = await fetch(url, {
        method: init?.method ?? "GET",
        headers: { Accept: "application/json", "User-Agent": "EmpleaTech/0.1 (+https://github.com/Tiggreee/empleatechnology)", ...init?.headers },
        body: init?.body,
        signal: AbortSignal.timeout(timeoutMs),
        redirect: "follow",
        cache: "no-store",
      });
      if (!res.ok) throw new Error(`respondió ${res.status}`);
      const largo = Number(res.headers.get("content-length") ?? 0);
      if (largo > MAX_BYTES) throw new Error("respuesta demasiado grande");
      const texto = await res.text();
      if (texto.length > MAX_BYTES) throw new Error("respuesta demasiado grande");
      try {
        return JSON.parse(texto) as unknown;
      } catch {
        throw new Error("no respondió JSON");
      }
    },
  };
}

export function contextoReal(ahora = new Date()): ContextoFuente {
  return { http: httpReal(), claves: clavesDelEntorno(), ahora };
}
