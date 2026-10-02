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
/**
 * Primero las que contratan en México o LatAm (verificado en sus tableros: Clara, Sezzle y Stripe tienen decenas de
 * vacantes ahí; Wizeline, Kavak, Kueski, Belvo, Blue Coding y Spin by OXXO, varias), luego remotas globales.
 */
export const EMPRESAS_INICIALES: Record<FuenteDeEmpresas, string[]> = {
  greenhouse: ["wizeline", "clara", "sezzle", "spin", "stripe", "gitlab", "twilio", "okta", "cloudflare", "mongodb"],
  lever: ["kavak", "bluecoding", "toptal"],
  ashby: ["kueski", "belvo", "supabase", "posthog", "zapier"],
};

const CLAVES = ["ADZUNA_APP_ID", "ADZUNA_APP_KEY", "JOOBLE_API_KEY", "USAJOBS_API_KEY", "USAJOBS_EMAIL"] as const;

export function clavesDelEntorno(): Record<string, string | undefined> {
  return Object.fromEntries(CLAVES.map((k) => [k, process.env[k]?.trim() || undefined]));
}

const MAX_BYTES = 15 * 1024 * 1024;

/** Cliente HTTP real: tiempo límite (25 s: desde Vercel algunas fuentes tardan más que desde México), tope de tamaño y errores con el código. */
export function httpReal(timeoutMs = 25_000): Http {
  return {
    async json(url, init) {
      const res = await fetch(url, {
        method: init?.method ?? "GET",
        headers: { Accept: "application/json", "User-Agent": "EmpleaTech/1.0 (+https://empleatech.site)", ...init?.headers },
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
