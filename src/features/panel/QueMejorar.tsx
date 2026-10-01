"use client";

import { useEffect, useState } from "react";
import type { Oportunidad } from "@/core/vacantes/oportunidades";
import { pedir } from "@/features/vacantes/cliente";
import { Aviso, EnlaceBoton, Insignia } from "@/ui/ui";

interface Datos {
  oportunidades: Oportunidad[];
  empleos: number;
  sobre90: number;
  mejor: number | null;
}

/**
 * Qué te subiría el puntaje: lo que te piden las vacantes que encontramos y tu CV no muestra. Cada fila dice cuánto
 * subirían (recalculado con el mismo motor) y qué hacer: agregarla al CV si ya la dominas, o aprenderla.
 */
export default function QueMejorar() {
  const [datos, setDatos] = useState<Datos | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    pedir<Datos>("/api/vacantes/aprender")
      .then(setDatos)
      .catch((e: unknown) => setError(e instanceof Error ? e.message : "No pudimos calcularlo."));
  }, []);

  return (
    <section aria-labelledby="que-mejorar" className="mt-10 border-t-2 border-texto pt-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 id="que-mejorar" className="text-3xl font-black tracking-tight sm:text-4xl">
            Qué te subiría el puntaje
          </h2>
          <p className="mt-2 max-w-2xl text-tenue">
            Lo que más te piden las vacantes que encontramos y tu CV todavía no muestra. Si ya lo dominas, agrégalo a tu CV con un ejemplo; si no, es lo que más vale la pena aprender.
          </p>
        </div>
        {datos && datos.empleos > 0 && (
          <p className="font-mono text-xs uppercase tracking-widest text-tenue">
            {datos.sobre90} de {datos.empleos} empleos en 90+{datos.mejor !== null ? ` · tu mejor: ${datos.mejor}` : ""}
          </p>
        )}
      </div>

      {error && (
        <Aviso tono="riesgo" className="mt-4">
          {error}
        </Aviso>
      )}
      {!datos && !error && (
        <p role="status" className="mt-4 font-mono text-xs uppercase tracking-widest text-tenue">
          Calculando con tus vacantes…
        </p>
      )}
      {datos && datos.empleos === 0 && (
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <p className="text-tenue">Aún no hay vacantes de empleo para comparar contra tu CV.</p>
          <EnlaceBoton variante="secundario" href="/vacantes">
            Buscar vacantes
          </EnlaceBoton>
        </div>
      )}
      {datos && datos.empleos > 0 && datos.oportunidades.length === 0 && (
        <Aviso tono="ok" className="mt-4">
          Tu CV ya cubre lo que piden tus vacantes. Lo que sigue es postular.
        </Aviso>
      )}

      {datos && datos.oportunidades.length > 0 && (
        <ol className="mt-6 border-t border-texto" aria-label="Habilidades que más subirían tu puntaje">
          {datos.oportunidades.map((o, i) => (
            <li key={o.id} className="grid gap-x-6 gap-y-2 border-b border-texto py-5 md:grid-cols-[3.5rem_minmax(0,14rem)_7rem_minmax(0,1fr)] md:items-start">
              <span aria-hidden="true" className="contorno hidden text-4xl font-black leading-[0.8] md:block">
                {String(i + 1).padStart(2, "0")}
              </span>
              <div>
                <h3 className="text-xl font-extrabold tracking-tight">{o.label}</h3>
                <p className="mt-1 flex flex-wrap gap-1.5">
                  <Insignia>{o.blanda ? "Habilidad blanda" : "Técnica"}</Insignia>
                </p>
              </div>
              <div>
                <p className="text-3xl font-black tracking-tight">+{o.puntos}</p>
                <p className="font-mono text-[11px] uppercase tracking-wider text-tenue">puntos en promedio</p>
              </div>
              <div className="text-sm">
                <p>
                  Te la piden en <strong>{o.vacantes} vacante{o.vacantes === 1 ? "" : "s"}</strong>
                  {o.a90 > 0 && (
                    <>
                      {" "}
                      · <strong className="text-cian">{o.a90} llegaría{o.a90 === 1 ? "" : "n"} a 90+</strong>
                    </>
                  )}
                  .
                </p>
                <p className="mt-1 text-tenue">
                  {o.blanda
                    ? "No se estudia: se demuestra. Escribe en tu CV un ejemplo concreto: dónde la usaste, con quién y qué resultado tuvo."
                    : "¿Ya la usas? Agrégala a tu CV diciendo dónde la usaste. ¿No? Es de lo que más te pide tu mercado."}
                  {!o.blanda && o.recurso && (
                    <>
                      {" "}
                      Empieza con{" "}
                      <a className="font-semibold text-texto underline underline-offset-4" href={o.recurso.url} target="_blank" rel="noopener noreferrer">
                        {o.recurso.nombre} ↗
                      </a>
                      .
                    </>
                  )}
                </p>
                <details className="mt-2">
                  <summary className="cursor-pointer font-mono text-[11px] uppercase tracking-wider text-tenue">Dónde la piden</summary>
                  <ul className="mt-1 list-disc pl-5 text-tenue">
                    {o.ejemplos.map((e) => (
                      <li key={e}>{e}</li>
                    ))}
                  </ul>
                </details>
              </div>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
