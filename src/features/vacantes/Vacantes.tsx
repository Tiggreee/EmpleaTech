"use client";

import { useCallback, useEffect, useState } from "react";
import { cvActivo } from "@/core/perfil/perfil";
import { ETIQUETA_RECOMENDACION } from "@/core/seguimiento/prioridad";
import { analizarOferta, crear } from "@/core/seguimiento/seguimiento";
import type { ResultadoFuente } from "@/core/vacantes/busqueda";
import { MAX_FUENTES_ACTIVAS, type FuenteDeEmpresas } from "@/core/vacantes/fuentes";
import type { PreferenciasBusqueda } from "@/core/vacantes/preferencias";
import type { FuenteId } from "@/core/vacantes/vacante";
import { useDatosApp } from "@/storage/hooks";
import { Aviso, Bloques, Boton, Encabezado, EnlaceBoton, Insignia, Puntaje, Tarjeta, Vacio, cx, type Tono } from "@/ui/ui";
import { MODALIDAD, TONO_RECOMENDACION, hace, nombreFuente, pedir, salario, type DatosVacantes as Datos, type EstadoVacante as Estado, type FuenteDisponible as Fuente, type Guardada } from "./cliente";

const PESTANAS: { estado: Estado; texto: string }[] = [
  { estado: "nueva", texto: "Por revisar" },
  { estado: "guardada", texto: "Guardadas" },
  { estado: "descartada", texto: "Descartadas" },
];

function Preferencias({ inicial, fuentes, onGuardar }: { inicial: PreferenciasBusqueda; fuentes: Fuente[]; onGuardar: (p: PreferenciasBusqueda) => Promise<void> }) {
  const [p, setP] = useState(inicial);
  const [palabras, setPalabras] = useState(inicial.palabras.join(", "));
  const [guardando, setGuardando] = useState(false);
  const deEmpleo = fuentes.filter((f) => !f.freelance);
  const deFreelance = fuentes.filter((f) => f.freelance);
  const activasDeEmpleo = p.fuentes.filter((id) => deEmpleo.some((f) => f.id === id)).length;
  const llenas = activasDeEmpleo >= MAX_FUENTES_ACTIVAS;

  const alternar = (id: FuenteId, activa: boolean) => setP({ ...p, fuentes: activa ? [...p.fuentes, id] : p.fuentes.filter((f) => f !== id) });
  const empresasDe = (f: FuenteDeEmpresas) => p.empresas[f].join(", ");

  const casilla = (f: Fuente, conTope: boolean) => {
    const activa = p.fuentes.includes(f.id);
    const bloqueada = !f.disponible || (conTope && !activa && llenas);
    return (
      <li key={f.id}>
        <label className={cx("flex h-full gap-2 rounded-xl border p-3 text-sm", activa ? "border-cian/50 bg-cian/5" : "border-linea", bloqueada && !activa && "opacity-60")}>
          <input type="checkbox" className="mt-0.5" checked={activa} disabled={bloqueada && !activa} onChange={(e) => alternar(f.id, e.target.checked)} />
          <span>
            <span className="font-medium">{f.nombre}</span>
            {!f.disponible && <span className="ml-2 text-xs text-aviso">requiere clave</span>}
            <span className="mt-0.5 block text-xs text-tenue">{f.descripcion}</span>
          </span>
        </label>
      </li>
    );
  };

  return (
    <div className="space-y-5">
      <label className="block text-sm">
        <span className="mb-1 block font-medium">Puestos o palabras clave</span>
        <input className="campo" value={palabras} onChange={(e) => setPalabras(e.target.value)} placeholder="Ej.: Backend Developer, Analista de datos" />
        <span className="mt-1 block text-xs text-tenue">Separa con comas. Buscamos en español e inglés: «Analista de datos» también encuentra «Data Analyst».</span>
      </label>

      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={p.soloRemoto} onChange={(e) => setP({ ...p, soloRemoto: e.target.checked })} />
        Solo vacantes remotas
      </label>

      <fieldset>
        <legend className="mb-2 text-sm font-medium">
          Plataformas de empleo <span className="font-normal text-tenue">({activasDeEmpleo} de {MAX_FUENTES_ACTIVAS})</span>
        </legend>
        <ul className="grid gap-2 sm:grid-cols-2">{deEmpleo.map((f) => casilla(f, true))}</ul>
      </fieldset>

      <fieldset>
        <legend className="mb-2 text-sm font-medium">
          Proyectos freelance <span className="font-normal text-tenue">(extra: no cuentan en el límite)</span>
        </legend>
        <ul className="grid gap-2 sm:grid-cols-2">{deFreelance.map((f) => casilla(f, false))}</ul>
      </fieldset>

      {(["greenhouse", "lever", "ashby"] as const)
        .filter((f) => p.fuentes.includes(f))
        .map((f) => (
          <label key={f} className="block text-sm">
            <span className="mb-1 block font-medium">Empresas en {fuentes.find((x) => x.id === f)?.nombre}</span>
            <input
              className="campo"
              defaultValue={empresasDe(f)}
              onChange={(e) => setP({ ...p, empresas: { ...p.empresas, [f]: e.target.value.split(",").map((t) => t.trim().toLowerCase()).filter(Boolean) } })}
            />
            <span className="mt-1 block text-xs text-tenue">El identificador del tablero, como aparece en su URL (p. ej. «wizeline» en job-boards.greenhouse.io/wizeline).</span>
          </label>
        ))}

      <Boton
        disabled={guardando}
        onClick={() => {
          setGuardando(true);
          void onGuardar({ ...p, palabras: palabras.split(",").map((x) => x.trim()).filter(Boolean) }).finally(() => setGuardando(false));
        }}
      >
        {guardando ? "Guardando…" : "Guardar preferencias"}
      </Boton>
    </div>
  );
}

function TarjetaVacante({ item, ahora, onGuardar, onDescartar }: { item: Guardada; ahora: number; onGuardar?: () => Promise<void>; onDescartar?: () => Promise<void> }) {
  const { vacante: v, prioridad, resumen } = item;
  const [ocupado, setOcupado] = useState(false);
  const accion = (fn?: () => Promise<void>) => () => {
    if (!fn) return;
    setOcupado(true);
    void fn().finally(() => setOcupado(false));
  };
  const fuente = nombreFuente(v.fuente);
  return (
    <article className="grid grid-cols-[4.5rem_minmax(0,1fr)] gap-4 border-b border-texto py-6 sm:grid-cols-[5.5rem_minmax(0,1fr)] sm:gap-6" aria-label={`${v.titulo} en ${v.empresa}`}>
      <div>
        <span className="sm:hidden">
          <Puntaje valor={prioridad.valor} etiqueta="prioridad" tamano={72} />
        </span>
        <span className="hidden sm:block">
          <Puntaje valor={prioridad.valor} etiqueta="prioridad" tamano={88} />
        </span>
        {prioridad.valor !== null && <span className="sr-only">Prioridad {prioridad.valor} de 100</span>}
      </div>
      <div className="min-w-0">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-xl font-extrabold leading-tight tracking-tight sm:text-2xl">{v.titulo}</h3>
          <p className="mt-1 font-mono text-xs uppercase tracking-wider text-tenue">
            {v.empresa} / {fuente}
          </p>
        </div>
        <Insignia tono={TONO_RECOMENDACION[prioridad.recomendacion]}>{ETIQUETA_RECOMENDACION[prioridad.recomendacion]}</Insignia>
      </div>

      {resumen.total > 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <Bloques cubiertas={resumen.cubiertas} total={resumen.total} />
          <span className="font-mono text-xs">
            Cubres {resumen.cubiertas} de {resumen.total} requisitos
          </span>
        </div>
      )}

      <div className="mt-3 flex flex-wrap gap-1.5">
        {v.modalidad && <Insignia>{MODALIDAD[v.modalidad]}</Insignia>}
        {v.ubicacion && <Insignia>{v.ubicacion.length > 40 ? `${v.ubicacion.slice(0, 40)}…` : v.ubicacion}</Insignia>}
        {v.tipo === "proyecto" && <Insignia tono="cian">Proyecto freelance</Insignia>}
        {salario(v.salario) && <Insignia tono="ok">{salario(v.salario)}</Insignia>}
        {v.propuestas !== undefined && <Insignia>{v.propuestas} propuesta{v.propuestas === 1 ? "" : "s"}</Insignia>}
        {hace(v.publicadaEn, ahora) && <Insignia>{hace(v.publicadaEn, ahora)}</Insignia>}
        {resumen.riesgo !== "limpia" && <Insignia tono={resumen.riesgo === "riesgo" ? "riesgo" : "aviso"}>{resumen.riesgo === "riesgo" ? "Oferta riesgosa" : "Revisar con cuidado"}</Insignia>}
      </div>

      <details className="mt-3 text-sm">
        <summary className="cursor-pointer font-semibold underline underline-offset-4">Por qué esta prioridad</summary>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-tenue">
          {prioridad.factores.map((f) => <li key={f}>{f}</li>)}
          {resumen.brechas.length > 0 && <li>Te falta: {resumen.brechas.join(", ")}</li>}
        </ul>
      </details>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        {onGuardar && <Boton pequeno disabled={ocupado} onClick={accion(onGuardar)}>Guardar en postulaciones</Boton>}
        {onDescartar && <Boton pequeno variante="secundario" disabled={ocupado} onClick={accion(onDescartar)}>Descartar</Boton>}
        {item.estado !== "descartada" && (
          <EnlaceBoton pequeno variante="secundario" href={`/preparar?vacante=${encodeURIComponent(v.id)}`}>
            {v.tipo === "proyecto" ? "Preparar propuesta" : "Preparar CV y carta"}
          </EnlaceBoton>
        )}
        <a className="ml-auto font-mono text-xs uppercase tracking-wider underline underline-offset-4" href={v.url} target="_blank" rel="noopener noreferrer">
          Ver en {fuente} ↗
        </a>
      </div>
      </div>
    </article>
  );
}

export default function Vacantes() {
  const { perfil, postulaciones, guardarEstado, cargando: cargandoPerfil } = useDatosApp();
  const [pestana, setPestana] = useState<Estado>("nueva");
  const [datos, setDatos] = useState<Datos | null>(null);
  const [msg, setMsg] = useState<{ tono: Tono; texto: string } | null>(null);
  const [buscando, setBuscando] = useState(false);
  const [reporte, setReporte] = useState<ResultadoFuente[] | null>(null);
  const [ahora, setAhora] = useState(0);
  const cv = cvActivo(perfil);

  const cargar = useCallback(async (estado: Estado) => {
    try {
      const d = await pedir<Datos>(`/api/vacantes?estado=${estado}`);
      setDatos(d);
      setAhora(Date.now());
    } catch (e) {
      setMsg({ tono: "riesgo", texto: e instanceof Error ? e.message : "No se pudieron cargar las vacantes." });
    }
  }, []);

  useEffect(() => {
    // Si cambias de pestaña antes de que responda, se ignora la respuesta vieja.
    let activo = true;
    void (async () => {
      try {
        const d = await pedir<Datos>(`/api/vacantes?estado=${pestana}`);
        if (!activo) return;
        setDatos(d);
        setAhora(Date.now());
      } catch (e) {
        if (activo) setMsg({ tono: "riesgo", texto: e instanceof Error ? e.message : "No se pudieron cargar las vacantes." });
      }
    })();
    return () => {
      activo = false;
    };
  }, [pestana]);

  async function buscar() {
    setBuscando(true);
    setMsg(null);
    try {
      const r = await pedir<{ reporte: ResultadoFuente[]; encontradas: number; nuevas: number }>("/api/vacantes/buscar", { method: "POST" });
      setReporte(r.reporte);
      setMsg({ tono: "ok", texto: r.nuevas ? `Encontramos ${r.nuevas} vacante${r.nuevas === 1 ? "" : "s"} nueva${r.nuevas === 1 ? "" : "s"}.` : "No hay vacantes nuevas por ahora." });
      setPestana("nueva");
      await cargar("nueva");
    } catch (e) {
      setMsg({ tono: "riesgo", texto: e instanceof Error ? e.message : "No se pudo buscar." });
    } finally {
      setBuscando(false);
    }
  }

  async function cambiarEstado(id: string, estado: Estado) {
    try {
      await pedir("/api/vacantes", { method: "PATCH", body: JSON.stringify({ id, estado }) });
      await cargar(pestana);
    } catch (e) {
      setMsg({ tono: "riesgo", texto: e instanceof Error ? e.message : "No se pudo actualizar la vacante." });
    }
  }

  async function guardarEnTracker(item: Guardada) {
    if (!cv) return;
    try {
      const v = item.vacante;
      const texto = `${v.titulo}\n${v.descripcion}`;
      const nueva = crear(postulaciones, { empresa: v.empresa, puesto: v.titulo, url: v.urlPostular ?? v.url, oferta: analizarOferta(cv.texto, texto, cv.id, new Date()) }, new Date(), crypto.randomUUID());
      await guardarEstado({ postulaciones: nueva });
      await cambiarEstado(v.id, "guardada");
      setMsg({ tono: "ok", texto: `«${v.titulo}» pasó a tus postulaciones.` });
    } catch (e) {
      setMsg({ tono: "riesgo", texto: e instanceof Error ? e.message : "No se pudo guardar." });
    }
  }

  return (
    <main className="mx-auto max-w-5xl px-5 py-10">
      <Encabezado
        titulo="Vacantes"
        descripcion="Buscamos en las plataformas que elijas, quitamos duplicados y ordenamos todo por qué tan bien encaja con tu CV y tus preferencias."
        acciones={cv ? <Boton onClick={() => void buscar()} disabled={buscando || !datos?.preferencias.fuentes.length}>{buscando ? "Buscando…" : "Buscar ahora"}</Boton> : undefined}
      />

      {msg && <Aviso tono={msg.tono} className="mb-6">{msg.texto}</Aviso>}

      {!cargandoPerfil && !cv && (
        <div className="mb-8">
          <Vacio titulo="Primero sube tu CV" accion={<EnlaceBoton href="/cv">Subir mi CV</EnlaceBoton>}>
            Lo usamos para decidir qué buscar y para ordenar las vacantes por afinidad.
          </Vacio>
        </div>
      )}

      {reporte && (
        <Tarjeta titulo="Resultado por plataforma" className="mb-6">
          <ul className="grid gap-1 text-sm sm:grid-cols-2">
            {reporte.map((r) => (
              <li key={r.fuente} className="flex justify-between gap-3">
                <span>{datos?.fuentes.find((f) => f.id === r.fuente)?.nombre ?? r.fuente}</span>
                <span className={cx("text-right", r.estado === "error" ? "text-riesgo" : r.estado === "omitida" ? "text-aviso" : "text-tenue")}>
                  {r.estado === "ok" ? `${r.aceptadas} de ${r.encontradas}` : r.detalle}
                </span>
              </li>
            ))}
          </ul>
        </Tarjeta>
      )}

      {datos && (
        <details className="mb-8" open={!datos.conteo.nueva && !datos.conteo.guardada && !datos.conteo.descartada}>
          <summary className="cursor-pointer text-sm font-medium text-cian">Dónde y qué buscar</summary>
          <div className="mt-4">
            <Tarjeta>
              <Preferencias
                key={JSON.stringify(datos.preferencias)}
                inicial={datos.preferencias}
                fuentes={datos.fuentes}
                onGuardar={async (p) => {
                  try {
                    await pedir("/api/vacantes", { method: "PUT", body: JSON.stringify(p) });
                    await cargar(pestana);
                    setMsg({ tono: "ok", texto: "Preferencias guardadas." });
                  } catch (e) {
                    setMsg({ tono: "riesgo", texto: e instanceof Error ? e.message : "No se pudieron guardar." });
                  }
                }}
              />
            </Tarjeta>
          </div>
        </details>
      )}

      {datos && (
        <>
          <div role="tablist" aria-label="Estado de las vacantes" className="mb-4 flex gap-1">
            {PESTANAS.map((p) => (
              <button
                key={p.estado}
                role="tab"
                type="button"
                aria-selected={pestana === p.estado}
                onClick={() => setPestana(p.estado)}
                className={cx("rounded-lg px-3 py-1.5 text-sm", pestana === p.estado ? "bg-texto text-fondo" : "text-tenue hover:text-texto")}
              >
                {p.texto} ({datos.conteo[p.estado]})
              </button>
            ))}
          </div>

          {datos.vacantes.length === 0 ? (
            <Vacio titulo={pestana === "nueva" ? "No hay vacantes por revisar" : "Nada por aquí"}>
              {pestana === "nueva" && cv ? "Pulsa «Buscar ahora» para traer vacantes de tus plataformas." : undefined}
            </Vacio>
          ) : (
            <div className="border-t-2 border-texto">
              {datos.vacantes.map((item) => (
                <TarjetaVacante
                  key={item.vacante.id}
                  item={item}
                  ahora={ahora}
                  onGuardar={item.estado === "nueva" && cv ? () => guardarEnTracker(item) : undefined}
                  onDescartar={item.estado === "nueva" ? () => cambiarEstado(item.vacante.id, "descartada") : undefined}
                />
              ))}
            </div>
          )}
        </>
      )}
    </main>
  );
}
