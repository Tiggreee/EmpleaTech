"use client";

import { useId, useState } from "react";
import { SELLO_ITEMS } from "@/core/seguimiento/seguimiento";
import { Boton } from "@/ui/ui";

export default function SelloHumano({ onConfirmar }: { onConfirmar: (items: string[]) => void }) {
  const [marcados, setMarcados] = useState<string[]>([]);
  const id = useId();
  const completo = SELLO_ITEMS.every((i) => marcados.includes(i));
  return (
    <details className="mt-2 rounded-lg border border-white/10 bg-white/5 p-2 text-xs">
      <summary className="cursor-pointer text-cian">Marcar con sello humano</summary>
      <p className="mt-2 text-tenue">La app no envía nada por ti. Confirma cada punto y registra la postulación solo cuando la hayas enviado tú.</p>
      <fieldset className="mt-2 space-y-1.5">
        <legend className="sr-only">Confirmaciones antes de postular</legend>
        {SELLO_ITEMS.map((item, i) => (
          <label key={item} htmlFor={`${id}-${i}`} className="flex items-start gap-2">
            <input id={`${id}-${i}`} type="checkbox" className="mt-0.5" checked={marcados.includes(item)} onChange={(e) => setMarcados((m) => (e.target.checked ? [...m, item] : m.filter((x) => x !== item)))} />
            <span>{item}</span>
          </label>
        ))}
      </fieldset>
      <Boton className="mt-2 w-full" pequeno disabled={!completo} onClick={() => onConfirmar(marcados)}>
        Marcar como postulada
      </Boton>
    </details>
  );
}

