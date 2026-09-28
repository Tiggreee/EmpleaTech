"use client";

import { useId, useState, type DragEvent } from "react";
import { cx } from "@/ui/ui";
import { ErrorImportacion, extraerTextoDeArchivo, type CvExtraido } from "./importar";

interface Props {
  onTexto: (texto: string, meta: { nombreArchivo: string; extraido: CvExtraido }) => void;
  etiqueta?: string;
  compacto?: boolean;
}

export default function SubirCv({ onTexto, etiqueta = "Sube tu CV (PDF, DOCX, ODT, TXT o MD)", compacto }: Props) {
  const id = useId();
  const [estado, setEstado] = useState<{ tipo: "libre" | "leyendo" | "ok" | "error"; texto?: string; avisos?: string[] }>({ tipo: "libre" });
  const [arrastrando, setArrastrando] = useState(false);

  async function procesar(archivo: File) {
    setEstado({ tipo: "leyendo", texto: `Leyendo ${archivo.name}…` });
    try {
      const extraido = await extraerTextoDeArchivo(archivo);
      onTexto(extraido.texto, { nombreArchivo: archivo.name, extraido });
      setEstado({
        tipo: "ok",
        texto: `Leído ${archivo.name}${extraido.paginas ? ` (${extraido.paginas} pág.)` : ""}. Todo se procesó en tu navegador.`,
        avisos: extraido.avisos,
      });
    } catch (e) {
      const mensaje = e instanceof ErrorImportacion ? e.message : "No pudimos leer el archivo. Prueba con otro o pega el texto.";
      setEstado({ tipo: "error", texto: mensaje });
    }
  }

  function alSoltar(e: DragEvent<HTMLLabelElement>) {
    e.preventDefault();
    setArrastrando(false);
    const f = e.dataTransfer.files?.[0];
    if (f) void procesar(f);
  }

  return (
    <div>
      <label
        htmlFor={id}
        onDragOver={(e) => {
          e.preventDefault();
          setArrastrando(true);
        }}
        onDragLeave={() => setArrastrando(false)}
        onDrop={alSoltar}
        className={cx(
          "flex cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed text-center transition-colors focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-cian",
          compacto ? "px-4 py-4" : "px-6 py-8",
          arrastrando ? "border-cian bg-cian/10" : "border-white/20 hover:border-white/40",
        )}
      >
        <span className="text-sm font-medium">{etiqueta}</span>
        <span className="mt-1 text-xs text-tenue">Arrástralo aquí o haz clic. Máx. 5 MB. El archivo no sale de tu navegador.</span>
        <input
          id={id}
          type="file"
          className="sr-only"
          accept=".pdf,.docx,.odt,.txt,.md,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.oasis.opendocument.text,text/plain,text/markdown"
          onChange={(e) => {
            const f = e.target.files?.[0];
            e.target.value = "";
            if (f) void procesar(f);
          }}
        />
      </label>
      <div aria-live="polite" className="mt-2 min-h-5 text-xs">
        {estado.tipo === "leyendo" && <p className="text-tenue">{estado.texto}</p>}
        {estado.tipo === "ok" && (
          <>
            <p className="text-ok">{estado.texto}</p>
            {estado.avisos?.map((a) => (
              <p key={a} className="mt-1 text-aviso">{a}</p>
            ))}
          </>
        )}
        {estado.tipo === "error" && <p role="alert" className="text-riesgo">{estado.texto}</p>}
      </div>
    </div>
  );
}
