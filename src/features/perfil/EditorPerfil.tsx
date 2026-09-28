"use client";

import { useState, type ReactNode } from "react";
import type { Estudio, PerfilJson, Trabajo } from "@/core/perfil/estructurado";
import { Boton, Insignia } from "@/ui/ui";

interface Props {
  perfil: PerfilJson;
  editado: boolean;
  onGuardar: (perfil: PerfilJson) => Promise<void>;
  onReleer: () => Promise<void>;
}

function Campo({ etiqueta, valor, onCambio, tipo = "text", placeholder, ancho }: { etiqueta: string; valor: string | undefined; onCambio: (v: string) => void; tipo?: string; placeholder?: string; ancho?: string }) {
  return (
    <label className={`block text-sm ${ancho ?? ""}`}>
      <span className="mb-1 block text-xs text-tenue">{etiqueta}</span>
      <input className="campo" type={tipo} value={valor ?? ""} placeholder={placeholder} onChange={(e) => onCambio(e.target.value)} />
    </label>
  );
}

function Grupo({ titulo, children, accion }: { titulo: string; children: ReactNode; accion?: ReactNode }) {
  return (
    <fieldset className="border-t border-white/10 pt-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <legend className="text-sm font-semibold">{titulo}</legend>
        {accion}
      </div>
      {children}
    </fieldset>
  );
}

/** "" → undefined para que el JSON guardado no tenga claves vacías. */
const v = (s: string) => (s.trim() ? s : undefined);
const FECHA = "AAAA-MM";

export default function EditorPerfil({ perfil, editado, onGuardar, onReleer }: Props) {
  const [p, setP] = useState<PerfilJson>(perfil);
  const [guardando, setGuardando] = useState(false);
  const b = p.basics;

  const basics = (cambios: Partial<PerfilJson["basics"]>) => setP({ ...p, basics: { ...b, ...cambios } });
  const trabajo = (i: number, cambios: Partial<Trabajo>) => setP({ ...p, work: p.work.map((w, k) => (k === i ? { ...w, ...cambios } : w)) });
  const estudio = (i: number, cambios: Partial<Estudio>) => setP({ ...p, education: p.education.map((e, k) => (k === i ? { ...e, ...cambios } : e)) });

  async function guardar() {
    setGuardando(true);
    try {
      await onGuardar(p);
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-2">
        <Campo etiqueta="Nombre completo" valor={b.name} onCambio={(x) => basics({ name: x })} />
        <Campo etiqueta="Título profesional" valor={b.label} onCambio={(x) => basics({ label: v(x) })} placeholder="Ej.: Desarrolladora Backend" />
        <Campo etiqueta="Correo" tipo="email" valor={b.email} onCambio={(x) => basics({ email: v(x) })} />
        <Campo etiqueta="Teléfono" tipo="tel" valor={b.phone} onCambio={(x) => basics({ phone: v(x) })} />
        <Campo etiqueta="Ciudad" valor={b.location?.city} onCambio={(x) => basics({ location: { ...b.location, city: v(x) } })} />
        <Campo etiqueta="País (código de 2 letras)" valor={b.location?.countryCode} onCambio={(x) => basics({ location: { ...b.location, countryCode: v(x.toUpperCase().slice(0, 2)) } })} placeholder="MX" />
        <Campo etiqueta="Sitio o portafolio" tipo="url" valor={b.url} onCambio={(x) => basics({ url: v(x) })} placeholder="https://" ancho="sm:col-span-2" />
      </div>

      <Grupo titulo="Perfiles en línea" accion={<Boton pequeno variante="secundario" onClick={() => basics({ profiles: [...b.profiles, { network: "", url: "" }] })}>Agregar</Boton>}>
        <ul className="space-y-2">
          {b.profiles.map((pr, i) => (
            <li key={i} className="grid gap-2 sm:grid-cols-[10rem_1fr_auto] sm:items-end">
              <Campo etiqueta="Red" valor={pr.network} onCambio={(x) => basics({ profiles: b.profiles.map((o, k) => (k === i ? { ...o, network: x } : o)) })} placeholder="LinkedIn" />
              <Campo etiqueta="Enlace" tipo="url" valor={pr.url} onCambio={(x) => basics({ profiles: b.profiles.map((o, k) => (k === i ? { ...o, url: x } : o)) })} placeholder="https://" />
              <Boton pequeno variante="peligro" aria-label={`Quitar perfil ${pr.network || i + 1}`} onClick={() => basics({ profiles: b.profiles.filter((_, k) => k !== i) })}>Quitar</Boton>
            </li>
          ))}
        </ul>
      </Grupo>

      <Grupo titulo="Resumen">
        <label className="block text-sm">
          <span className="sr-only">Resumen profesional</span>
          <textarea className="campo h-24 resize-y" value={b.summary ?? ""} onChange={(e) => basics({ summary: v(e.target.value) })} placeholder="Dos o tres líneas sobre tu experiencia y lo que buscas." />
        </label>
      </Grupo>

      <Grupo titulo={`Experiencia (${p.work.length})`} accion={<Boton pequeno variante="secundario" onClick={() => setP({ ...p, work: [...p.work, { highlights: [] }] })}>Agregar puesto</Boton>}>
        <ol className="space-y-4">
          {p.work.map((w, i) => (
            <li key={i} className="rounded-xl border border-white/10 p-3">
              <div className="grid gap-2 sm:grid-cols-2">
                <Campo etiqueta="Puesto" valor={w.position} onCambio={(x) => trabajo(i, { position: v(x) })} />
                <Campo etiqueta="Empresa" valor={w.name} onCambio={(x) => trabajo(i, { name: v(x) })} />
                <Campo etiqueta="Desde" valor={w.startDate} onCambio={(x) => trabajo(i, { startDate: v(x) })} placeholder={FECHA} />
                <Campo etiqueta="Hasta (vacío si es tu puesto actual)" valor={w.endDate} onCambio={(x) => trabajo(i, { endDate: v(x) })} placeholder={FECHA} />
              </div>
              <label className="mt-2 block text-sm">
                <span className="mb-1 block text-xs text-tenue">Logros (uno por línea)</span>
                <textarea
                  className="campo h-24 resize-y"
                  value={w.highlights.join("\n")}
                  onChange={(e) => trabajo(i, { highlights: e.target.value.split("\n") })}
                  onBlur={(e) => trabajo(i, { highlights: e.target.value.split("\n").map((l) => l.trim()).filter(Boolean) })}
                />
              </label>
              <div className="mt-2 text-right">
                <Boton pequeno variante="peligro" onClick={() => setP({ ...p, work: p.work.filter((_, k) => k !== i) })}>Quitar puesto</Boton>
              </div>
            </li>
          ))}
        </ol>
      </Grupo>

      <Grupo titulo={`Educación (${p.education.length})`} accion={<Boton pequeno variante="secundario" onClick={() => setP({ ...p, education: [...p.education, {}] })}>Agregar estudio</Boton>}>
        <ol className="space-y-3">
          {p.education.map((e, i) => (
            <li key={i} className="grid gap-2 rounded-xl border border-white/10 p-3 sm:grid-cols-2">
              <Campo etiqueta="Institución" valor={e.institution} onCambio={(x) => estudio(i, { institution: v(x) })} />
              <Campo etiqueta="Grado" valor={e.studyType} onCambio={(x) => estudio(i, { studyType: v(x) })} placeholder="Licenciatura, Ingeniería…" />
              <Campo etiqueta="Área" valor={e.area} onCambio={(x) => estudio(i, { area: v(x) })} />
              <Campo etiqueta="Año de término" valor={e.endDate} onCambio={(x) => estudio(i, { endDate: v(x) })} placeholder="AAAA" />
              <div className="sm:col-span-2 text-right">
                <Boton pequeno variante="peligro" onClick={() => setP({ ...p, education: p.education.filter((_, k) => k !== i) })}>Quitar estudio</Boton>
              </div>
            </li>
          ))}
        </ol>
      </Grupo>

      <Grupo titulo="Habilidades">
        <ul className="space-y-2">
          {p.skills.map((s, i) => (
            <li key={i}>
              <label className="block text-sm">
                <span className="mb-1 block text-xs text-tenue">{s.name}</span>
                <input
                  className="campo"
                  value={s.keywords.join(", ")}
                  onChange={(e) => setP({ ...p, skills: p.skills.map((o, k) => (k === i ? { ...o, keywords: e.target.value.split(",").map((x) => x.trimStart()) } : o)) })}
                />
              </label>
            </li>
          ))}
        </ul>
      </Grupo>

      <Grupo titulo="Idiomas" accion={<Boton pequeno variante="secundario" onClick={() => setP({ ...p, languages: [...p.languages, { language: "" }] })}>Agregar idioma</Boton>}>
        <ul className="grid gap-2 sm:grid-cols-2">
          {p.languages.map((l, i) => (
            <li key={i} className="grid grid-cols-2 gap-2">
              <Campo etiqueta="Idioma" valor={l.language} onCambio={(x) => setP({ ...p, languages: p.languages.map((o, k) => (k === i ? { ...o, language: x } : o)) })} />
              <Campo etiqueta="Nivel" valor={l.fluency} onCambio={(x) => setP({ ...p, languages: p.languages.map((o, k) => (k === i ? { ...o, fluency: v(x) } : o)) })} placeholder="Avanzado, C1…" />
            </li>
          ))}
        </ul>
      </Grupo>

      <div className="flex flex-wrap items-center gap-2 border-t border-white/10 pt-4">
        <Boton onClick={() => void guardar()} disabled={guardando}>{guardando ? "Guardando…" : "Guardar perfil"}</Boton>
        {editado && (
          <>
            <Insignia tono="cian">Con tus correcciones</Insignia>
            <Boton
              pequeno
              variante="secundario"
              onClick={() => {
                if (window.confirm("¿Descartar tus correcciones y volver a leer el perfil desde el texto del CV?")) void onReleer();
              }}
            >
              Volver a leer del CV
            </Boton>
          </>
        )}
      </div>
    </div>
  );
}
