"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { cvActivo } from "@/core/perfil/perfil";
import { ETIQUETA_RECOMENDACION } from "@/core/seguimiento/prioridad";
import { SELLO_ITEMS, analizarOferta, crear, marcarPostulada } from "@/core/seguimiento/seguimiento";
import { armarCola } from "@/core/vacantes/cola";
import { esFuenteFreelance } from "@/core/vacantes/fuentes";
import { MODALIDAD, TONO_RECOMENDACION, avisoExtension, cambiarEstadoVacante, hace, nombreFuente, pedir, salario, type DatosVacantes, type Guardada } from "@/features/vacantes/cliente";
import { useDatosApp } from "@/storage/hooks";
import { Aviso, Bloques, Boton, Encabezado, EnlaceBoton, Insignia, Puntaje, Vacio, type Tono } from "@/ui/ui";
import Mazo from "./Mazo";

const CONFIRMACION = `Confirma que ya la enviaste tú:\n\n${SELLO_ITEMS.map((s) => `• ${s}`).join("\n")}`;

export default function Hoy() {
  const { perfil, postulaciones, guardarEstado, cargando } = useDatosApp();
  const [datos, setDatos] = useState<DatosVacantes | null>(null);
  const [ahora, setAhora] = useState<Date | null>(null);
  const [msg, setMsg] = useState<{ tono: Tono; texto: string } | null>(null);
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [ajustes, setAjustes] = useState(false);
  const cv = cvActivo(perfil);

  const recargar = useCallback(async () => {
    const d = await pedir<DatosVacantes>("/api/vacantes?estado=nueva");
    setDatos(d);
    setAhora(new Date());
  }, []);

  useEffect(() => {
    let activo = true;
    void (async () => {
      try {
        const d = await pedir<DatosVacantes>("/api/vacantes?estado=nueva");
        if (!activo) return;
        setDatos(d);
        setAhora(new Date());
      } catch (e) {
        if (activo) setMsg({ tono: "riesgo", texto: e instanceof Error ? e.message : "No se pudieron cargar tus vacantes." });
      }
    })();
    return () => {
      activo = false;
    };
  }, []);

  async function hacer(id: string, fn: () => Promise<void>) {
    setOcupado(id);
    try {
      await fn();
    } catch (e) {
      setMsg({ tono: "riesgo", texto: e instanceof Error ? e.message : "No se pudo completar." });
    } finally {
      setOcupado(null);
    }
  }

  const enviada = (item: Guardada) =>
    hacer(item.vacante.id, async () => {
      if (!cv || !window.confirm(CONFIRMACION)) return;
      const v = item.vacante;
      const fecha = new Date();
      const id = crypto.randomUUID();
      const lista = crear(postulaciones, { empresa: v.empresa, puesto: v.titulo, url: v.urlPostular ?? v.url, oferta: analizarOferta(cv.texto, `${v.titulo}\n${v.descripcion}`, cv.id, fecha) }, fecha, id);
      await guardarEstado({ postulaciones: marcarPostulada(lista, id, [...SELLO_ITEMS], fecha) });
      await cambiarEstadoVacante(v.id, "guardada");
      setMsg({ tono: "ok", texto: `Enviada: ${v.titulo} en ${v.empresa}. Quedó en tus postulaciones.` });
      await recargar();
    });

  const saltar = (item: Guardada) =>
    hacer(item.vacante.id, async () => {
      await cambiarEstadoVacante(item.vacante.id, "descartada");
      await recargar();
    });

  const buscar = () =>
    hacer("buscar", async () => {
      const r = await pedir<{ nuevas: number }>("/api/vacantes/buscar", { method: "POST" });
      setMsg({ tono: "ok", texto: r.nuevas ? `Encontramos ${r.nuevas} vacante${r.nuevas === 1 ? "" : "s"} nueva${r.nuevas === 1 ? "" : "s"}.` : "No hay vacantes nuevas por ahora." });
      await recargar();
    });

  if (!cargando && !cv) {
    return (
      <main className="mx-auto max-w-6xl px-5 py-10">
        <Encabezado titulo="Tus vacantes de hoy" />
        <Vacio titulo="Primero sube tu CV" accion={<EnlaceBoton href="/cv">Subir mi CV</EnlaceBoton>}>
          Con tu CV buscamos, ordenamos y preparamos todo. Tú solo revisas y envías.
        </Vacio>
      </main>
    );
  }

  const prefs = datos?.preferencias;
  // La meta de freelance solo cuenta si buscas en alguna plataforma de proyectos.
  const conFreelance = !!prefs?.fuentes.some(esFuenteFreelance);
  const cola =
    datos && ahora && prefs
      ? armarCola(datos.vacantes, postulaciones, { metaDiaria: prefs.metaDiaria, metaFreelance: conFreelance ? prefs.metaFreelance : 0, topePorFuente: prefs.topePorFuente }, ahora)
      : null;
  const meta = cola ? cola.empleos.meta + cola.freelance.meta : 0;
  const avance = cola && meta ? Math.min(100, Math.round((cola.enviadasHoy / meta) * 100)) : 0;
  const pendientes = cola?.items.length ?? 0;
  const fecha = ahora?.toLocaleDateString("es-MX", { weekday: "long", day: "numeric", month: "long" });

  return (
    <main className="mx-auto max-w-6xl px-5 py-10">
      <section className="mb-10 grid items-end gap-8 border-b-2 border-texto pb-8 md:grid-cols-[minmax(0,1fr)_auto]">
        <div>
          <p className="font-mono text-xs uppercase tracking-widest text-tenue">{fecha ?? "Hoy"}</p>
          <h1 className="mt-3 text-5xl font-black leading-[0.9] tracking-[-0.05em] sm:text-7xl lg:text-8xl">
            {cola && pendientes > 0 ? `Hoy: ${pendientes} por enviar.` : "Tus vacantes de hoy"}
          </h1>
          <p className="mt-4 max-w-xl text-lg text-tenue">Cada una ya trae su CV y su carta. Tú revisas, abres el formulario y envías.</p>
          <div className="mt-6 flex flex-wrap gap-2">
            <Boton variante="secundario" onClick={() => void buscar()} disabled={ocupado === "buscar"}>
              {ocupado === "buscar" ? "Buscando…" : "Buscar más"}
            </Boton>
            <EnlaceBoton variante="secundario" href="/autollenado">
              Autollenado
            </EnlaceBoton>
          </div>
        </div>

        {cola && prefs && (
          <div aria-label="Avance del día" role="group" className="md:text-right">
            <p aria-hidden="true" className="text-6xl font-black leading-[0.85] tracking-[-0.06em] sm:text-8xl lg:text-9xl">
              {cola.enviadasHoy}
              <span className="text-linea">/{meta}</span>
            </p>
            <div className="mt-3 h-2 w-full bg-superficie md:ml-auto md:w-64" role="progressbar" aria-label="Avance de la meta diaria" aria-valuemin={0} aria-valuemax={100} aria-valuenow={avance}>
              <div className="h-full bg-naranja" style={{ width: `${avance}%` }} />
            </div>
            <p className="mt-3 font-mono text-xs uppercase tracking-widest text-tenue">
              <span>
                {cola.empleos.enviadas} de {cola.empleos.meta} empleos
              </span>
              {cola.freelance.meta > 0 && (
                <>
                  {" · "}
                  <span>
                    {cola.freelance.enviadas} de {cola.freelance.meta} freelance
                  </span>
                </>
              )}
              {" · "}
              <button type="button" className="uppercase underline underline-offset-4 hover:text-texto" onClick={() => setAjustes(!ajustes)}>
                Ajustar meta
              </button>
            </p>
          </div>
        )}
      </section>

      {ajustes && prefs && (
        <form
          className="mb-8 flex flex-wrap items-end gap-3 border-2 border-texto bg-papel p-4 text-sm"
          onSubmit={(e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            void hacer("ajustes", async () => {
              await pedir("/api/vacantes", {
                method: "PUT",
                body: JSON.stringify({
                  ...prefs,
                  metaDiaria: Number(f.get("meta")),
                  metaFreelance: f.has("freelance") ? Number(f.get("freelance")) : prefs.metaFreelance,
                  topePorFuente: Number(f.get("tope")),
                }),
              });
              setAjustes(false);
              await recargar();
            });
          }}
        >
          <label>
            <span className="mb-1 block font-mono text-[11px] uppercase tracking-wider text-tenue">Empleos al día</span>
            <input name="meta" type="number" min={1} max={100} defaultValue={prefs.metaDiaria} className="campo w-28" />
          </label>
          {conFreelance && (
            <label>
              <span className="mb-1 block font-mono text-[11px] uppercase tracking-wider text-tenue">Freelance al día</span>
              <input name="freelance" type="number" min={0} max={50} defaultValue={prefs.metaFreelance} className="campo w-28" />
            </label>
          )}
          <label>
            <span className="mb-1 block font-mono text-[11px] uppercase tracking-wider text-tenue">Máximo por plataforma</span>
            <input name="tope" type="number" min={1} max={50} defaultValue={prefs.topePorFuente} className="campo w-28" />
          </label>
          <Boton type="submit">Guardar</Boton>
        </form>
      )}

      {msg && (
        <Aviso tono={msg.tono} className="mb-6">
          {msg.texto}
        </Aviso>
      )}

      {!cola && !msg && (
        <p role="status" className="font-mono text-xs uppercase tracking-widest text-tenue">
          Preparando tus vacantes…
        </p>
      )}

      {cola && cola.faltanHoy === 0 && (
        <Aviso tono="ok" titulo="¡Meta del día cumplida!">
          Descansa o, si quieres más, sube la meta. Mañana te esperan nuevas.
        </Aviso>
      )}

      {cola && cola.faltanHoy > 0 && pendientes === 0 && (
        <Vacio titulo="No hay vacantes listas por ahora" accion={<Boton onClick={() => void buscar()} disabled={ocupado === "buscar"}>Buscar vacantes</Boton>}>
          Buscamos en tus plataformas y te dejamos las mejores aquí. Puedes ajustar qué buscar en{" "}
          <Link className="font-semibold underline underline-offset-4" href="/vacantes">
            Vacantes
          </Link>
          .
        </Vacio>
      )}

      {cola && pendientes > 0 && (
        <>
          <Mazo items={cola.items} ahora={ahora} ocupado={ocupado} onEnviada={(i) => enviada(i as Guardada)} onSaltar={(i) => saltar(i as Guardada)} />

          <ol className="hidden border-t-2 border-texto md:block" aria-label="Vacantes de hoy">
            {cola.items.map((item, i) => {
              const v = item.vacante;
              const g = item as Guardada;
              const cuando = ahora ? hace(v.publicadaEn, ahora.getTime()) : null;
              const sal = salario(v.salario);
              const r = item.resumen;
              const proyecto = v.tipo === "proyecto";
              return (
                <li key={v.id} className="border-b border-texto">
                  <article className="grid grid-cols-[4.5rem_6rem_minmax(0,1fr)_15rem] items-start gap-6 py-7" aria-label={`${v.titulo} en ${v.empresa}`}>
                    <span aria-hidden="true" className="contorno text-6xl font-black leading-[0.8] tracking-[-0.05em]">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <Puntaje valor={item.prioridad.valor} tamano={96} />
                    <div className="flex min-w-0 flex-col gap-3">
                      <h2 className="text-2xl font-extrabold leading-tight tracking-tight lg:text-3xl">{v.titulo}</h2>
                      <p className="font-mono text-xs uppercase tracking-wider text-tenue">
                        {v.empresa} / vía {nombreFuente(v.fuente)}
                        {cuando ? ` / ${cuando}` : ""}
                      </p>
                      {r.total > 0 ? (
                        <div className="flex flex-wrap items-center gap-3">
                          <Bloques cubiertas={r.cubiertas} total={r.total} />
                          <span className="font-mono text-xs">
                            Cubres {r.cubiertas} de {r.total} requisitos
                          </span>
                        </div>
                      ) : (
                        <p className="text-sm text-tenue">{item.prioridad.factores[0] ?? "Sin análisis suficiente."}</p>
                      )}
                      {r.brechas.length > 0 && (
                        <p className="text-sm">
                          Te falta: <strong>{r.brechas.slice(0, 3).join(", ")}</strong>
                        </p>
                      )}
                      <div className="flex flex-wrap gap-1.5">
                        <Insignia tono={TONO_RECOMENDACION[item.prioridad.recomendacion]}>{ETIQUETA_RECOMENDACION[item.prioridad.recomendacion]}</Insignia>
                        {v.modalidad && <Insignia>{MODALIDAD[v.modalidad]}</Insignia>}
                        {sal && <Insignia tono="ok">{sal}</Insignia>}
                        {v.ats && <Insignia tono="cian">Formulario {v.ats}</Insignia>}
                        {proyecto && <Insignia tono="cian">Proyecto freelance{v.propuestas !== undefined ? ` · ${v.propuestas} propuestas` : ""}</Insignia>}
                        <Insignia tono={avisoExtension(v).tono}>{avisoExtension(v).texto}</Insignia>
                      </div>
                    </div>
                    <div className="flex flex-col gap-2">
                      <EnlaceBoton href={`/preparar?vacante=${encodeURIComponent(v.id)}`}>{proyecto ? "Propuesta →" : "CV y carta →"}</EnlaceBoton>
                      <a className="boton boton-sec" href={v.urlPostular ?? v.url} target="_blank" rel="noopener noreferrer">
                        {proyecto ? "Abrir proyecto ↗" : "Abrir formulario ↗"}
                      </a>
                      <div className="grid grid-cols-2 gap-2">
                        <Boton variante="secundario" disabled={ocupado === v.id} onClick={() => void enviada(g)}>
                          Ya la envié
                        </Boton>
                        <button
                          type="button"
                          className="text-sm font-semibold text-tenue underline underline-offset-4 hover:text-texto disabled:opacity-40"
                          disabled={ocupado === v.id}
                          onClick={() => void saltar(g)}
                        >
                          Saltar
                        </button>
                      </div>
                    </div>
                  </article>
                </li>
              );
            })}
          </ol>
        </>
      )}
    </main>
  );
}
