"use client";

import { useState } from "react";
import { ETIQUETA_RECOMENDACION, type Prioridad } from "@/core/seguimiento/prioridad";
import { DIAS_SEGUIMIENTO, cambiarEstado, editarNotas, eliminar, marcarPostulada, programarSeguimiento, siguienteAccion, urlSegura, type Postulacion } from "@/core/seguimiento/seguimiento";
import { TONO_RECOMENDACION } from "@/features/analizar/ResultadoAnalisis";
import { Boton, EnlaceBoton, Insignia } from "@/ui/ui";
import SelloHumano from "./SelloHumano";

const TONO_ACCION = { ok: "text-tenue", atencion: "text-aviso", urgente: "text-riesgo font-medium" } as const;

interface Props {
  p: Postulacion;
  prioridad: Prioridad;
  ahora: Date;
  aplicar: (fn: (l: Postulacion[]) => Postulacion[]) => void;
}

function Notas({ p, aplicar }: Pick<Props, "p" | "aplicar">) {
  const [texto, setTexto] = useState(p.notas ?? "");
  const cambio = texto.trim() !== (p.notas ?? "");
  return (
    <details className="mt-2 text-xs">
      <summary className="cursor-pointer text-tenue">{p.notas ? "Notas (1)" : "Agregar notas"}</summary>
      <textarea aria-label={`Notas de ${p.puesto} en ${p.empresa}`} className="campo mt-2 h-20 !text-xs" value={texto} maxLength={2000} onChange={(e) => setTexto(e.target.value)} placeholder="Contacto, salario ofrecido, próximos pasos…" />
      <Boton className="mt-1" pequeno variante="secundario" disabled={!cambio} onClick={() => aplicar((l) => editarNotas(l, p.id, texto, new Date()))}>Guardar notas</Boton>
    </details>
  );
}

export default function TarjetaPostulacion({ p, prioridad, ahora, aplicar }: Props) {
  const accion = siguienteAccion(p, ahora);
  const enlace = urlSegura(p.url);
  const resumen = p.oferta?.resumen;

  return (
    <article id={`p-${p.id}`} className="vidrio p-3 text-sm">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-medium">{p.puesto}</p>
          <p className="text-tenue">{p.empresa}</p>
        </div>
        {p.score !== undefined && <Insignia title="Afinidad al analizar la oferta">{p.score}%</Insignia>}
      </div>

      {p.oferta && p.estado === "guardada" && (
        <div className="mt-2">
          <Insignia tono={TONO_RECOMENDACION[prioridad.recomendacion]}>{ETIQUETA_RECOMENDACION[prioridad.recomendacion]}</Insignia>
          {resumen && resumen.brechas.length > 0 && (
            <p className="mt-2 text-xs text-tenue">Te faltan: {resumen.brechas.slice(0, 3).join(", ")}{resumen.brechas.length > 3 ? "…" : ""}</p>
          )}
          <details className="mt-1 text-xs text-tenue">
            <summary className="cursor-pointer text-cian">Por qué</summary>
            <ul className="mt-1 list-disc space-y-0.5 pl-4">{prioridad.factores.map((f) => <li key={f}>{f}</li>)}</ul>
          </details>
          <EnlaceBoton pequeno variante="secundario" className="mt-2" href={`/preparar?postulacion=${encodeURIComponent(p.id)}`}>
            Preparar CV y carta
          </EnlaceBoton>
        </div>
      )}

      {enlace && <a href={enlace} target="_blank" rel="noopener noreferrer" className="mt-1 block truncate text-xs text-cian underline underline-offset-2">{enlace}</a>}
      <p className={`mt-2 text-xs ${TONO_ACCION[accion.tono]}`}>→ {accion.texto}</p>

      {p.estado === "guardada" && <SelloHumano onConfirmar={(items) => aplicar((l) => marcarPostulada(l, p.id, items, new Date()))} />}

      {p.estado === "postulada" && (
        <label className="mt-2 block text-xs text-tenue">
          Seguimiento (sugerido a los {DIAS_SEGUIMIENTO} días)
          <input type="date" className="campo mt-1 !py-1 !text-xs" value={p.seguimientoEn?.slice(0, 10) ?? ""} onChange={(e) => aplicar((l) => programarSeguimiento(l, p.id, e.target.value || undefined, new Date()))} />
        </label>
      )}

      {p.oferta && (
        <details className="mt-2 text-xs">
          <summary className="cursor-pointer text-tenue">Ver oferta guardada</summary>
          <pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap rounded-lg bg-superficie p-2 font-mono text-[11px] leading-relaxed text-tenue">{p.oferta.texto}</pre>
        </details>
      )}

      <Notas key={p.notas ?? ""} p={p} aplicar={aplicar} />

      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
        {p.estado === "postulada" && <Boton pequeno variante="secundario" onClick={() => aplicar((l) => cambiarEstado(l, p.id, "entrevista", new Date()))}>Pasó a entrevista</Boton>}
        {p.estado === "entrevista" && <Boton pequeno variante="secundario" onClick={() => aplicar((l) => cambiarEstado(l, p.id, "oferta", new Date()))}>Recibí oferta</Boton>}
        {p.estado !== "rechazada" && p.estado !== "oferta" && <Boton pequeno variante="secundario" onClick={() => aplicar((l) => cambiarEstado(l, p.id, "rechazada", new Date()))}>Cerrar</Boton>}
        <button
          className="text-riesgo underline underline-offset-2"
          onClick={() => {
            if (window.confirm(`¿Eliminar «${p.puesto}» en ${p.empresa}?`)) aplicar((l) => eliminar(l, p.id));
          }}
        >
          Eliminar
        </button>
      </div>
    </article>
  );
}
