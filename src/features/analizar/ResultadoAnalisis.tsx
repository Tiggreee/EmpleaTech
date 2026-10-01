import { nombreNivel, type Hallazgo, type Resultado } from "@/core/analisis/analizador";
import type { Diagnostico } from "@/core/radar/radar";
import { ETIQUETA_RECOMENDACION, type Prioridad, type Recomendacion } from "@/core/seguimiento/prioridad";
import { Anillo, Aviso, Insignia, Tarjeta, type Tono } from "@/ui/ui";

const ESTADO: Record<Hallazgo["estado"], { texto: string; tono: Tono }> = {
  cubierta: { texto: "Cubierta", tono: "ok" },
  transferible: { texto: "Transferible", tono: "aviso" },
  faltante: { texto: "Falta", tono: "riesgo" },
};
const SEVERIDAD = { alta: { et: "Grave", tono: "riesgo" }, media: { et: "Precaución", tono: "aviso" }, baja: { et: "Aviso", tono: "neutro" } } as const;
export const TONO_RECOMENDACION: Record<Recomendacion, Tono> = { postular: "ok", revisar: "aviso", descartar: "riesgo", "sin-analisis": "neutro" };

const idioma = (i: string) => (i === "es" ? "español" : i === "en" ? "inglés" : "idioma no determinado");

export default function ResultadoAnalisis({ resultado, diagnostico, prioridad }: { resultado: Resultado; diagnostico: Diagnostico; prioridad: Prioridad }) {
  return (
    <div className="space-y-6" aria-live="polite">
      {resultado.avisos.map((a) => (
        <Aviso key={a} tono="aviso">{a}</Aviso>
      ))}

      <Tarjeta className="flex flex-col items-center gap-6 sm:flex-row">
        {resultado.score !== null ? <Anillo valor={resultado.score} /> : <div className="grid h-[130px] w-[130px] place-items-center rounded-full border border-linea text-tenue">—</div>}
        <div className="flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-xl font-semibold">{resultado.veredicto}</h2>
            <Insignia tono={TONO_RECOMENDACION[prioridad.recomendacion]}>{ETIQUETA_RECOMENDACION[prioridad.recomendacion]}</Insignia>
          </div>
          <p className="mt-1 text-sm text-tenue">Oferta en {idioma(resultado.idiomaOferta)} · CV en {idioma(resultado.idiomaCv)}</p>
          <dl className="mt-4 grid grid-cols-3 gap-3 text-center text-sm">
            {(["requerida", "funcion", "deseable"] as const).map((n) => (
              <div key={n} className="rounded-xl bg-superficie/70 px-2 py-2">
                <dt className="text-xs text-tenue">{nombreNivel(n)}</dt>
                <dd className="font-semibold">{resultado.desglose[n].cubiertas}/{resultado.desglose[n].total}</dd>
              </div>
            ))}
          </dl>
          {resultado.experiencia && (
            <p className="mt-3 text-xs text-tenue">
              Experiencia: la oferta pide {resultado.experiencia.aniosPedidos}+ años;{" "}
              {resultado.experiencia.aniosCv !== null ? `tu CV declara ${resultado.experiencia.aniosCv}.` : resultado.experiencia.aniosEstimados !== null ? `por tus fechas estimamos ~${resultado.experiencia.aniosEstimados} (no puntúa hasta que lo declares).` : "tu CV no lo indica."}
            </p>
          )}
          <details className="mt-3 text-xs text-tenue">
            <summary className="cursor-pointer text-cian">¿Cómo se decidió esta recomendación?</summary>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              {prioridad.factores.map((f) => <li key={f}>{f}</li>)}
              {prioridad.valor !== null && <li>Prioridad final: {prioridad.valor}/100</li>}
            </ul>
          </details>
        </div>
      </Tarjeta>

      {resultado.hallazgos.length > 0 && (
        <div className="grid gap-5 md:grid-cols-2">
          <Tarjeta titulo="Por qué este puntaje">
            <ul className="space-y-2 text-sm text-tenue">
              {resultado.razones.map((r) => <li key={r}>✓ {r}</li>)}
              {resultado.razones.length === 0 && <li>Aún no hay coincidencias directas.</li>}
            </ul>
          </Tarjeta>
          <Tarjeta titulo="Tus brechas principales">
            <ul className="space-y-2 text-sm text-tenue">
              {resultado.brechas.map((b) => <li key={b}>△ {b}</li>)}
              {resultado.brechas.length === 0 && <li>No detectamos brechas. Revisa las alertas de la oferta.</li>}
            </ul>
          </Tarjeta>
        </div>
      )}

      <section aria-labelledby="alertas">
        <h2 id="alertas" className="mb-2 font-semibold">Radar de la oferta</h2>
        <p className={`mb-3 text-sm ${diagnostico.nivel === "riesgo" ? "text-riesgo" : diagnostico.nivel === "precaucion" ? "text-aviso" : "text-ok"}`}>{diagnostico.resumen}</p>
        <ul className="grid gap-3 md:grid-cols-2">
          {diagnostico.alertas.map((a) => (
            <li key={a.id}>
              <Aviso tono={SEVERIDAD[a.severidad].tono}>
                <p className="font-medium text-texto"><span className="mr-2 text-xs uppercase tracking-wide text-tenue">{SEVERIDAD[a.severidad].et}</span>{a.titulo}</p>
                <p className="mt-1 text-tenue">{a.detalle}</p>
                {a.evidencia && <p className="mt-2 font-mono text-xs text-tenue">«{a.evidencia}»</p>}
              </Aviso>
            </li>
          ))}
        </ul>
      </section>

      {resultado.hallazgos.length > 0 && (
        <section aria-labelledby="detalle">
          <h2 id="detalle" className="mb-3 font-semibold">Detalle por habilidad</h2>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="text-xs uppercase tracking-wide text-tenue">
                <tr><th className="py-2 pr-3">Habilidad</th><th className="pr-3">Nivel</th><th className="pr-3">Estado</th><th>Evidencia</th></tr>
              </thead>
              <tbody>
                {resultado.hallazgos.map((h) => (
                  <tr key={h.id} className="border-t border-linea align-top">
                    <td className="py-2.5 pr-3 font-medium">{h.label}</td>
                    <td className="pr-3 text-tenue">{nombreNivel(h.nivel)}</td>
                    <td className="pr-3"><Insignia tono={ESTADO[h.estado].tono}>{ESTADO[h.estado].texto}</Insignia></td>
                    <td className="text-xs text-tenue">
                      <p>Oferta: «{h.enOferta}»</p>
                      {h.enCv && <p className="mt-1">CV{h.via ? ` (${h.via})` : ""}: «{h.enCv}»</p>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {resultado.sugerencias.length > 0 && (
        <section>
          <h2 className="mb-3 font-semibold">Cómo cerrar la brecha (sin inventar)</h2>
          <ul className="space-y-2 text-sm text-tenue">
            {resultado.sugerencias.map((s) => <li key={s} className="vidrio px-4 py-3">{s}</li>)}
          </ul>
        </section>
      )}
    </div>
  );
}
