"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { cvActivo } from "@/core/perfil/perfil";
import { ETIQUETA_RECOMENDACION } from "@/core/seguimiento/prioridad";
import { SELLO_ITEMS, analizarOferta, crear, marcarPostulada } from "@/core/seguimiento/seguimiento";
import { armarCola, motivoPrincipal } from "@/core/vacantes/cola";
import { MODALIDAD, TONO_RECOMENDACION, cambiarEstadoVacante, hace, nombreFuente, pedir, salario, type DatosVacantes, type Guardada } from "@/features/vacantes/cliente";
import { useDatosApp } from "@/storage/hooks";
import { Aviso, Boton, Encabezado, EnlaceBoton, Insignia, Vacio, type Tono } from "@/ui/ui";

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
        if (activo) setMsg({ tono: "riesgo", texto: e instanceof Error ? e.message : "No se pudo cargar tu cola." });
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
      <main className="mx-auto max-w-4xl px-5 py-10">
        <Encabezado titulo="Tu cola de hoy" />
        <Vacio titulo="Primero sube tu CV" accion={<EnlaceBoton href="/cv">Subir mi CV</EnlaceBoton>}>
          Con tu CV buscamos, ordenamos y preparamos todo. Tú solo revisas y envías.
        </Vacio>
      </main>
    );
  }

  const prefs = datos?.preferencias;
  const cola = datos && ahora && prefs ? armarCola(datos.vacantes, postulaciones, { metaDiaria: prefs.metaDiaria, topePorFuente: prefs.topePorFuente }, ahora) : null;
  const meta = prefs?.metaDiaria ?? 0;
  const avance = cola && meta ? Math.min(100, Math.round((cola.enviadasHoy / meta) * 100)) : 0;

  return (
    <main className="mx-auto max-w-4xl px-5 py-10">
      <Encabezado
        titulo="Tu cola de hoy"
        descripcion="Las vacantes que mejor encajan, con tu CV y carta listos. Tu trabajo: revisar, abrir el formulario y enviar."
        acciones={
          <>
            <EnlaceBoton variante="secundario" href="/autollenado">Autollenado</EnlaceBoton>
            <Boton variante="secundario" onClick={() => void buscar()} disabled={ocupado === "buscar"}>{ocupado === "buscar" ? "Buscando…" : "Buscar más"}</Boton>
          </>
        }
      />

      {msg && <Aviso tono={msg.tono} className="mb-6">{msg.texto}</Aviso>}

      {cola && prefs && (
        <section className="mb-6" aria-label="Avance del día">
          <div className="mb-1 flex items-baseline justify-between text-sm">
            <p>
              <span className="text-2xl font-semibold">{cola.enviadasHoy}</span> <span className="text-tenue">de {meta} enviadas hoy</span>
            </p>
            <button type="button" className="text-xs text-cian" onClick={() => setAjustes(!ajustes)}>Ajustar meta</button>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-white/10" role="progressbar" aria-label="Avance de la meta diaria" aria-valuemin={0} aria-valuemax={100} aria-valuenow={avance}>
            <div className="h-full bg-gradient-to-r from-cian to-violeta" style={{ width: `${avance}%` }} />
          </div>
          {ajustes && (
            <form
              className="mt-3 flex flex-wrap items-end gap-3 text-sm"
              onSubmit={(e) => {
                e.preventDefault();
                const f = new FormData(e.currentTarget);
                void hacer("ajustes", async () => {
                  await pedir("/api/vacantes", { method: "PUT", body: JSON.stringify({ ...prefs, metaDiaria: Number(f.get("meta")), topePorFuente: Number(f.get("tope")) }) });
                  setAjustes(false);
                  await recargar();
                });
              }}
            >
              <label>
                <span className="mb-1 block text-xs text-tenue">Postulaciones al día</span>
                <input name="meta" type="number" min={1} max={100} defaultValue={prefs.metaDiaria} className="campo w-28" />
              </label>
              <label>
                <span className="mb-1 block text-xs text-tenue">Máximo por plataforma</span>
                <input name="tope" type="number" min={1} max={50} defaultValue={prefs.topePorFuente} className="campo w-28" />
              </label>
              <Boton type="submit" pequeno>Guardar</Boton>
            </form>
          )}
        </section>
      )}

      {cola && cola.faltanHoy === 0 && (
        <Aviso tono="ok" titulo="¡Meta del día cumplida!">Descansa o, si quieres más, sube la meta. Mañana te esperan nuevas.</Aviso>
      )}

      {cola && cola.faltanHoy > 0 && cola.items.length === 0 && (
        <Vacio titulo="No hay vacantes listas en tu cola" accion={<Boton onClick={() => void buscar()} disabled={ocupado === "buscar"}>Buscar vacantes</Boton>}>
          Buscamos en tus plataformas y armamos la cola. Puedes ajustar qué buscar en{" "}
          <Link className="text-cian underline" href="/vacantes">
            Vacantes
          </Link>
          .
        </Vacio>
      )}

      {cola && cola.items.length > 0 && (
        <ol className="space-y-3">
          {cola.items.map((item, i) => {
            const v = item.vacante;
            const g = item as Guardada;
            const cuando = ahora ? hace(v.publicadaEn, ahora.getTime()) : null;
            return (
              <li key={v.id}>
                <article className="vidrio p-4" aria-label={`${v.titulo} en ${v.empresa}`}>
                  <div className="flex items-start gap-3">
                    <span className="mt-0.5 w-6 shrink-0 text-right text-sm text-tenue">{i + 1}.</span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="min-w-0">
                          <h3 className="font-semibold">{v.titulo}</h3>
                          <p className="text-sm text-tenue">
                            {v.empresa} · vía {nombreFuente(v.fuente)}
                            {cuando ? ` · ${cuando}` : ""}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          {item.prioridad.valor !== null && <span className="text-xl font-semibold">{item.prioridad.valor}</span>}
                          <Insignia tono={TONO_RECOMENDACION[item.prioridad.recomendacion]}>{ETIQUETA_RECOMENDACION[item.prioridad.recomendacion]}</Insignia>
                        </div>
                      </div>
                      <p className="mt-1 text-sm">{motivoPrincipal(item)}</p>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {v.modalidad && <Insignia>{MODALIDAD[v.modalidad]}</Insignia>}
                        {salario(v.salario) && <Insignia tono="ok">{salario(v.salario)}</Insignia>}
                        {v.ats && <Insignia tono="cian">Formulario {v.ats}</Insignia>}
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <EnlaceBoton pequeno variante="secundario" href={`/preparar?vacante=${encodeURIComponent(v.id)}`}>CV y carta</EnlaceBoton>
                        <a className="boton boton-sec !px-2.5 !py-1.5 !text-xs" href={v.urlPostular ?? v.url} target="_blank" rel="noopener noreferrer">
                          Abrir formulario ↗
                        </a>
                        <Boton pequeno disabled={ocupado === v.id} onClick={() => void enviada(g)}>Ya la envié</Boton>
                        <Boton pequeno variante="secundario" disabled={ocupado === v.id} onClick={() => void saltar(g)}>Saltar</Boton>
                      </div>
                    </div>
                  </div>
                </article>
              </li>
            );
          })}
        </ol>
      )}
    </main>
  );
}
