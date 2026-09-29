"use client";

import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { MAX_PROPUESTA, prepararDocumentos, type IdiomaDoc } from "@/core/documentos/aMedida";
import { LIMITES, PLATAFORMAS, perfilFreelance, type EstadoPlataforma, type PlataformaId, type SeguimientoFreelance } from "@/core/freelance/freelance";
import { cvActivo, estructuradoDe } from "@/core/perfil/perfil";
import { pedir } from "@/features/vacantes/cliente";
import { useDatosApp } from "@/storage/hooks";
import { Aviso, Boton, Encabezado, EnlaceBoton, Insignia, Tarjeta, Vacio, cx } from "@/ui/ui";

const ESTADO: Record<EstadoPlataforma, string> = { pendiente: "Pendiente", registrado: "Ya estoy registrado", descartada: "No me interesa" };

function Contador({ n, max }: { n: number; max: number }) {
  return <span className={cx("tabular-nums", n > max ? "text-aviso" : "text-tenue")}>{n} / {max}</span>;
}

/** Un texto listo para copiar, con su límite de caracteres. */
function Copiable({ etiqueta, texto, max, alto = "h-24" }: { etiqueta: string; texto: string; max?: number; alto?: string }) {
  const [copiado, setCopiado] = useState(false);
  return (
    <div className="text-sm">
      <div className="mb-1 flex items-center justify-between gap-2 text-xs">
        <span className="font-medium text-[var(--texto)]">{etiqueta}</span>
        <span className="flex items-center gap-3">
          {max && <Contador n={texto.length} max={max} />}
          <button
            type="button"
            className="text-cian hover:underline"
            onClick={() => {
              void navigator.clipboard.writeText(texto).then(
                () => setCopiado(true),
                () => setCopiado(false),
              );
            }}
          >
            {copiado ? "Copiado" : "Copiar"}
          </button>
        </span>
      </div>
      <textarea readOnly aria-label={etiqueta} className={cx("campo resize-y leading-relaxed", alto)} value={texto} />
    </div>
  );
}

export default function Freelance() {
  const { perfil, cargando } = useDatosApp();
  const cv = cvActivo(perfil);
  const estructurado = useMemo(() => (cv ? estructuradoDe(cv) : null), [cv]);

  // 1) Propuesta para un proyecto que encontraste en una plataforma sin acceso automático.
  const [titulo, setTitulo] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [editada, setEditada] = useState<string | null>(null);
  const descripcionD = useDeferredValue(descripcion);
  const docs = useMemo(() => {
    if (!estructurado || descripcionD.trim().length < 40) return null;
    return prepararDocumentos(estructurado, { titulo: titulo.trim() || (descripcionD.trim().split("\n")[0] ?? "").slice(0, 80), empresa: "", texto: descripcionD, tipo: "proyecto" }, perfil.respuestas, new Date());
  }, [estructurado, titulo, descripcionD, perfil.respuestas]);
  const propuesta = editada ?? docs?.propuesta ?? "";

  // 2) Perfil freelance en los dos idiomas.
  const [idioma, setIdioma] = useState<IdiomaDoc>("en");
  const pf = useMemo(() => (estructurado ? perfilFreelance(estructurado, idioma) : null), [estructurado, idioma]);

  // 3) Dónde ya te registraste.
  const [seguimiento, setSeguimiento] = useState<SeguimientoFreelance | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let activo = true;
    pedir<{ seguimiento: SeguimientoFreelance }>("/api/freelance")
      .then((d) => activo && setSeguimiento(d.seguimiento))
      .catch((e: unknown) => activo && setError(e instanceof Error ? e.message : "No se pudo cargar tu avance."));
    return () => {
      activo = false;
    };
  }, []);

  async function cambiarEstado(id: PlataformaId, estado: EstadoPlataforma) {
    if (!seguimiento) return;
    const siguiente = { ...seguimiento, [id]: estado };
    setSeguimiento(siguiente);
    try {
      const d = await pedir<{ seguimiento: SeguimientoFreelance }>("/api/freelance", { method: "PUT", body: JSON.stringify({ seguimiento: siguiente }) });
      setSeguimiento(d.seguimiento);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo guardar.");
    }
  }

  if (!cargando && !cv) {
    return (
      <main className="mx-auto max-w-4xl px-5 py-10">
        <Vacio titulo="Primero sube tu CV" accion={<EnlaceBoton href="/cv">Subir mi CV</EnlaceBoton>}>
          Tus propuestas y tu perfil freelance salen de tu CV: sin él no hay de dónde sacar evidencia.
        </Vacio>
      </main>
    );
  }

  const registradas = seguimiento ? PLATAFORMAS.filter((p) => seguimiento[p.id] === "registrado").length : 0;

  return (
    <main className="mx-auto max-w-5xl space-y-8 px-5 py-10">
      <Encabezado
        titulo="Freelance"
        descripcion="Proyectos como un ingreso extra: propuestas a la medida, tu perfil listo para pegar en cada plataforma y dónde te falta registrarte."
        acciones={<EnlaceBoton variante="secundario" href="/vacantes">Proyectos de Freelancer.com y Braintrust</EnlaceBoton>}
      />
      {error && <Aviso tono="riesgo">{error}</Aviso>}

      <Tarjeta titulo="Propuesta para un proyecto que encontraste">
        <p className="mb-4 text-sm text-tenue">
          Workana y Upwork no permiten que una app lea sus proyectos. Ábrelos tú, copia la descripción aquí y te armamos la propuesta con tu evidencia real.
        </p>
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="space-y-3">
            <label className="block text-sm">
              <span className="mb-1 block font-medium">Título del proyecto (opcional)</span>
              <input className="campo" value={titulo} onChange={(e) => (setTitulo(e.target.value), setEditada(null))} placeholder="Ej.: API en Spring Boot para app de reservas" />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block font-medium">Descripción del proyecto</span>
              <textarea className="campo h-56 resize-y" value={descripcion} onChange={(e) => (setDescripcion(e.target.value), setEditada(null))} placeholder="Pega aquí lo que publicó el cliente." />
            </label>
            {docs && (docs.brechas.length > 0 || docs.enfasis.length > 0) && (
              <div className="space-y-2 text-xs">
                {docs.enfasis.length > 0 && <div className="flex flex-wrap gap-1">{docs.enfasis.slice(0, 8).map((e) => <Insignia key={e} tono="ok">{e}</Insignia>)}</div>}
                {docs.brechas.length > 0 && (
                  <p className="text-tenue">
                    Pide y no está en tu CV: {docs.brechas.join(", ")}. No lo agregamos por ti; si no lo dominas, quizá no es para ti.
                  </p>
                )}
              </div>
            )}
          </div>
          <div>
            {docs ? (
              <label className="block text-sm">
                <span className="mb-1 flex justify-between text-xs text-tenue">
                  <span>Edítala si quieres y pégala en la plataforma.</span>
                  <Contador n={propuesta.length} max={MAX_PROPUESTA} />
                </span>
                <textarea aria-label="Propuesta" className="campo h-72 resize-y leading-relaxed" value={propuesta} onChange={(e) => setEditada(e.target.value)} />
                <Boton className="mt-2" onClick={() => void navigator.clipboard.writeText(propuesta)}>
                  Copiar propuesta
                </Boton>
              </label>
            ) : (
              <p className="rounded-xl border border-dashed border-white/15 p-6 text-sm text-tenue">La propuesta aparece aquí en cuanto pegues la descripción.</p>
            )}
          </div>
        </div>
      </Tarjeta>

      {pf && (
        <Tarjeta
          titulo="Tu perfil freelance"
          acciones={
            <div role="tablist" aria-label="Idioma del perfil" className="flex gap-1">
              {(["en", "es"] as const).map((i) => (
                <button
                  key={i}
                  role="tab"
                  type="button"
                  aria-selected={idioma === i}
                  onClick={() => setIdioma(i)}
                  className={cx("rounded-lg px-3 py-1 text-sm", idioma === i ? "bg-white/10 text-white" : "text-tenue hover:text-white")}
                >
                  {i === "en" ? "English" : "Español"}
                </button>
              ))}
            </div>
          }
        >
          <p className="mb-4 text-sm text-tenue">
            Lo mismo que piden todas: titular, descripción y habilidades. Sale solo de tu CV; las frases de tu CV aparecen únicamente en el idioma en que las escribiste.
            Upwork, Toptal y Arc van mejor en inglés; Workana, en español.
          </p>
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="space-y-4">
              <Copiable etiqueta="Titular" texto={pf.titular} max={LIMITES.titular} alto="h-16" />
              <Copiable etiqueta="Habilidades" texto={pf.habilidades.join(", ")} alto="h-20" />
              <Copiable etiqueta="Título del gig (Fiverr)" texto={pf.gig.titulo} max={LIMITES.tituloGig} alto="h-16" />
            </div>
            <Copiable etiqueta="Descripción (Sobre mí / Overview)" texto={pf.descripcion} max={LIMITES.descripcion} alto="h-80" />
          </div>
        </Tarjeta>
      )}

      <Tarjeta titulo={`Dónde registrarte (${registradas} de ${PLATAFORMAS.length})`}>
        <ul className="grid gap-3 md:grid-cols-2">
          {PLATAFORMAS.map((p) => {
            const estado = seguimiento?.[p.id] ?? "pendiente";
            return (
              <li key={p.id} className={cx("rounded-xl border p-4 text-sm", estado === "registrado" ? "border-ok/40 bg-ok/5" : "border-white/10", estado === "descartada" && "opacity-60")} aria-label={p.nombre}>
                <div className="flex items-start justify-between gap-2">
                  <a className="font-semibold hover:underline" href={p.sitio} target="_blank" rel="noopener noreferrer">
                    {p.nombre} ↗
                  </a>
                  <select
                    aria-label={`Estado en ${p.nombre}`}
                    className="campo !w-auto !py-1 text-xs"
                    value={estado}
                    disabled={!seguimiento}
                    onChange={(e) => void cambiarEstado(p.id, e.target.value as EstadoPlataforma)}
                  >
                    {(Object.keys(ESTADO) as EstadoPlataforma[]).map((k) => (
                      <option key={k} value={k}>
                        {ESTADO[k]}
                      </option>
                    ))}
                  </select>
                </div>
                <p className="mt-1 text-tenue">{p.modelo}</p>
                <p className="mt-1 text-xs text-tenue">{p.ayuda}</p>
              </li>
            );
          })}
        </ul>
      </Tarjeta>
    </main>
  );
}
