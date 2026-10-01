"use client";

import { useEffect, useState } from "react";
import { DIMENSIONES, MIN_GRUPO, MIN_TOTAL, NOMBRE_DIMENSION, type Grupo } from "@/core/aprendizaje/aprendizaje";
import type { Resultados as DatosResultados } from "@/server/aprendizaje";
import { pedir } from "@/features/vacantes/cliente";
import { Aviso, Encabezado, EnlaceBoton, Estadistica, Tarjeta, Vacio } from "@/ui/ui";

/** Color de las barras: validado para fondo oscuro (luminosidad y contraste ≥ 3:1). */
const BARRA = "#0ea5c6";
const BARRA_POCOS_DATOS = "rgba(154, 167, 199, 0.45)";

const pct = (x: number | null) => (x === null ? "—" : `${Math.round(x * 100)}%`);

function Barras({ grupos, promedio, titulo }: { grupos: Grupo[]; promedio: number; titulo: string }) {
  const escala = Math.max(promedio, ...grupos.map((g) => g.tasa), 0.05) * 1.1;
  return (
    <Tarjeta titulo={titulo}>
      <ul className="space-y-2.5">
        {grupos.map((g) => (
          <li key={g.valor} className="grid grid-cols-[minmax(7rem,11rem)_1fr_auto] items-center gap-3 text-sm" title={`Con 95 % de confianza, entre ${pct(g.bajo)} y ${pct(g.alto)}.`}>
            <span className="truncate">{g.valor}</span>
            <span className="relative h-2 rounded-full bg-white/5" aria-hidden="true">
              <span className="absolute inset-y-0 left-0 rounded-full" style={{ width: `${(g.tasa / escala) * 100}%`, minWidth: g.tasa ? 4 : 0, background: g.pocosDatos ? BARRA_POCOS_DATOS : BARRA }} />
              <span className="absolute -inset-y-1 w-0.5 bg-[var(--tenue)]" style={{ left: `${(promedio / escala) * 100}%` }} />
            </span>
            <span className="whitespace-nowrap text-right tabular-nums text-tenue">
              <span className="text-[var(--texto)]">{pct(g.tasa)}</span> · {g.entrevistas} de {g.n}
              {g.pocosDatos && <span className="ml-1.5 text-xs">(pocos datos)</span>}
            </span>
          </li>
        ))}
      </ul>
    </Tarjeta>
  );
}

export default function Resultados() {
  const [d, setD] = useState<DatosResultados | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let activo = true;
    void (async () => {
      try {
        const r = await pedir<DatosResultados>("/api/aprendizaje");
        if (activo) setD(r);
      } catch (e) {
        if (activo) setError(e instanceof Error ? e.message : "No se pudieron cargar tus resultados.");
      }
    })();
    return () => {
      activo = false;
    };
  }, []);

  return (
    <main className="mx-auto max-w-5xl px-5 py-10">
      <Encabezado
        titulo="Qué te funciona"
        descripcion="De todo lo que envías, qué llega a entrevista: por plataforma, nivel, modalidad, versión de CV y afinidad. Con estos datos la cola de hoy se reordena sola hacia lo que te responde."
      />
      {error && <Aviso tono="riesgo" className="mb-6">{error}</Aviso>}
      {!d && !error && (
        <p role="status" className="text-sm text-tenue">
          Cargando tus resultados…
        </p>
      )}

      {d && d.total === 0 && (
        <Vacio titulo="Aún no has enviado postulaciones" accion={<EnlaceBoton href="/hoy">Ir a mi cola de hoy</EnlaceBoton>}>
          En cuanto envíes, aquí verás qué te está funcionando. Cuando te llamen a entrevista, márcalo en Postulaciones.
        </Vacio>
      )}

      {d && d.total > 0 && (
        <div className="space-y-6">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <Estadistica etiqueta="Enviadas" valor={d.total} pista={`${d.ultimos7} en los últimos 7 días`} />
            <Estadistica etiqueta="Llegaron a entrevista" valor={pct(d.tasa)} pista={`${d.entrevistas} de ${d.total}`} tono={d.suficiente && d.tasa && d.tasa >= 0.05 ? "ok" : undefined} />
            <Estadistica etiqueta="Ofertas" valor={d.ofertas} />
            <Estadistica etiqueta="Días a la entrevista" valor={d.diasPromedioRespuesta ?? "—"} pista="promedio desde que envías" />
            <Estadistica etiqueta="Para concluir" valor={d.suficiente ? "Listo" : `${d.total}/${MIN_TOTAL}`} pista={d.suficiente ? "ya ajustamos tu cola" : "postulaciones enviadas"} />
          </div>

          <section aria-label="Recomendaciones" className="space-y-2">
            {d.recomendaciones.map((r) => (
              <Aviso key={r.texto} tono={r.tono === "ok" ? "ok" : "aviso"}>{r.texto}</Aviso>
            ))}
          </section>

          <p className="text-xs text-tenue">
            Porcentaje que llegó a entrevista en cada grupo. La raya vertical marca tu promedio ({pct(d.tasa)}); los grupos con menos de {MIN_GRUPO} postulaciones van en gris. Pasa el cursor sobre un grupo para ver su margen de error.
          </p>
          <div className="grid gap-6 lg:grid-cols-2">
            {DIMENSIONES.map((dim) => d.porDimension[dim].length > 0 && <Barras key={dim} titulo={NOMBRE_DIMENSION[dim]} grupos={d.porDimension[dim]} promedio={d.tasa ?? 0} />)}
          </div>

          {d.saltadas.length > 0 && (
            <Tarjeta titulo="Vacantes que saltas, por plataforma">
              <ul className="space-y-1.5 text-sm">
                {d.saltadas.map((s) => (
                  <li key={s.fuente} className="flex justify-between gap-3">
                    <span>{s.fuente}</span>
                    <span className="tabular-nums text-tenue">
                      saltas {s.saltadas} de {s.revisadas} ({pct(s.revisadas ? s.saltadas / s.revisadas : null)})
                    </span>
                  </li>
                ))}
              </ul>
              <p className="mt-3 text-xs text-tenue">Si una plataforma te trae muchas que saltas, quizá conviene cambiarla por otra en Vacantes.</p>
            </Tarjeta>
          )}
        </div>
      )}
    </main>
  );
}
