"use client";

import { useCallback, useEffect, useState } from "react";
import { cvActivo } from "@/core/perfil/perfil";
import { ETIQUETA_RECOMENDACION } from "@/core/seguimiento/prioridad";
import { analizarOferta, crear } from "@/core/seguimiento/seguimiento";
import type { ResultadoFuente, VacantePuntuada } from "@/core/vacantes/busqueda";
import { MAX_FUENTES_ACTIVAS, type FuenteDeEmpresas, type InfoFuente } from "@/core/vacantes/fuentes";
import type { PreferenciasBusqueda } from "@/core/vacantes/preferencias";
import type { FuenteId, SalarioVacante } from "@/core/vacantes/vacante";
import { useDatosApp } from "@/storage/hooks";
import { Aviso, Boton, Encabezado, EnlaceBoton, Insignia, Tarjeta, Vacio, cx, type Tono } from "@/ui/ui";

type Estado = "nueva" | "guardada" | "descartada";
type Guardada = VacantePuntuada & { estado: Estado; encontradaEn: string };
type Fuente = InfoFuente & { disponible: boolean };

interface Datos {
  vacantes: Guardada[];
  conteo: Record<Estado, number>;
  preferencias: PreferenciasBusqueda;
  fuentes: Fuente[];
}

const PESTANAS: { estado: Estado; texto: string }[] = [
  { estado: "nueva", texto: "Por revisar" },
  { estado: "guardada", texto: "Guardadas" },
  { estado: "descartada", texto: "Descartadas" },
];
const MODALIDAD = { remoto: "Remoto", hibrido: "Híbrido", presencial: "Presencial" } as const;
const PERIODO = { hora: "/h", mes: "/mes", año: "/año" } as const;
const TONO_RECOMENDACION: Record<string, Tono> = { postular: "ok", revisar: "cian", descartar: "riesgo", "sin-analisis": "neutro" };

async function pedir<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { cache: "no-store", ...init, headers: { "Content-Type": "application/json", ...init?.headers } });
  const body = (await res.json().catch(() => null)) as (T & { error?: string }) | null;
  if (!res.ok || !body) throw new Error(body?.error ?? "No se pudo completar la operación.");
  return body;
}

function salario(s: SalarioVacante | undefined): string | null {
  if (!s) return null;
  const f = (n: number) => (n >= 10_000 ? `${Math.round(n / 1000)}k` : n.toLocaleString("es-MX"));
  const rango = s.min && s.max && s.min !== s.max ? `${f(s.min)}–${f(s.max)}` : f((s.max ?? s.min) as number);
  return `${rango} ${s.moneda ?? ""}${s.periodo ? ` ${PERIODO[s.periodo]}` : ""}`.trim();
}

function hace(iso: string | undefined, ahora: number): string | null {
  if (!iso || !ahora) return null;
  const dias = Math.floor((ahora - new Date(iso).getTime()) / 86_400_000);
  return dias <= 0 ? "hoy" : dias === 1 ? "ayer" : `hace ${dias} días`;
}

function Preferencias({ inicial, fuentes, onGuardar }: { inicial: PreferenciasBusqueda; fuentes: Fuente[]; onGuardar: (p: PreferenciasBusqueda) => Promise<void> }) {
  const [p, setP] = useState(inicial);
  const [palabras, setPalabras] = useState(inicial.palabras.join(", "));
  const [guardando, setGuardando] = useState(false);
  const llenas = p.fuentes.length >= MAX_FUENTES_ACTIVAS;

  const alternar = (id: FuenteId, activa: boolean) => setP({ ...p, fuentes: activa ? [...p.fuentes, id] : p.fuentes.filter((f) => f !== id) });
  const empresasDe = (f: FuenteDeEmpresas) => p.empresas[f].join(", ");

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
          Plataformas <span className="font-normal text-tenue">({p.fuentes.length} de {MAX_FUENTES_ACTIVAS})</span>
        </legend>
        <ul className="grid gap-2 sm:grid-cols-2">
          {fuentes.map((f) => {
            const activa = p.fuentes.includes(f.id);
            const bloqueada = !f.disponible || (!activa && llenas);
            return (
              <li key={f.id}>
                <label className={cx("flex h-full gap-2 rounded-xl border p-3 text-sm", activa ? "border-cian/50 bg-cian/5" : "border-white/10", bloqueada && !activa && "opacity-60")}>
                  <input type="checkbox" className="mt-0.5" checked={activa} disabled={bloqueada && !activa} onChange={(e) => alternar(f.id, e.target.checked)} />
                  <span>
                    <span className="font-medium">{f.nombre}</span>
                    {!f.disponible && <span className="ml-2 text-xs text-aviso">requiere clave</span>}
                    <span className="mt-0.5 block text-xs text-tenue">{f.descripcion}</span>
                  </span>
                </label>
              </li>
            );
          })}
        </ul>
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
  const nombreFuente = v.fuente === "getonboard" ? "Get on Board" : v.fuente.charAt(0).toUpperCase() + v.fuente.slice(1);
  return (
    <article className="vidrio p-5" aria-label={`${v.titulo} en ${v.empresa}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="font-semibold">{v.titulo}</h3>
          <p className="text-sm text-tenue">{v.empresa}</p>
        </div>
        <div className="text-right">
          {prioridad.valor !== null && <p className="text-2xl font-semibold" aria-label={`Prioridad ${prioridad.valor} de 100`}>{prioridad.valor}</p>}
          <Insignia tono={TONO_RECOMENDACION[prioridad.recomendacion]}>{ETIQUETA_RECOMENDACION[prioridad.recomendacion]}</Insignia>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {v.modalidad && <Insignia>{MODALIDAD[v.modalidad]}</Insignia>}
        {v.ubicacion && <Insignia>{v.ubicacion.length > 40 ? `${v.ubicacion.slice(0, 40)}…` : v.ubicacion}</Insignia>}
        {salario(v.salario) && <Insignia tono="ok">{salario(v.salario)}</Insignia>}
        {hace(v.publicadaEn, ahora) && <Insignia>{hace(v.publicadaEn, ahora)}</Insignia>}
        {resumen.riesgo !== "limpia" && <Insignia tono={resumen.riesgo === "riesgo" ? "riesgo" : "aviso"}>{resumen.riesgo === "riesgo" ? "Oferta riesgosa" : "Revisar con cuidado"}</Insignia>}
      </div>

      <details className="mt-3 text-sm">
        <summary className="cursor-pointer text-cian">Por qué esta prioridad</summary>
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
            Preparar CV y carta
          </EnlaceBoton>
        )}
        <a className="ml-auto text-xs text-cian underline-offset-2 hover:underline" href={v.url} target="_blank" rel="noopener noreferrer">
          Ver en {nombreFuente} ↗
        </a>
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
                className={cx("rounded-lg px-3 py-1.5 text-sm", pestana === p.estado ? "bg-white/10 text-white" : "text-tenue hover:text-white")}
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
            <div className="space-y-4">
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
