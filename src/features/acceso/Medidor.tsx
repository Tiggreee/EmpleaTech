"use client";

import { NOMBRE_NIVEL, evaluarContrasena } from "@/core/acceso/fuerza";
import { cx } from "@/ui/ui";

const COLOR = ["bg-riesgo", "bg-riesgo", "bg-aviso", "bg-cian", "bg-ok"] as const;

/**
 * Qué tan fuerte es la contraseña mientras la escribes. Solo orienta: la misma regla la vuelve a aplicar el servidor.
 * `id` es para el aria-describedby del campo.
 */
export default function Medidor({ contrasena, id }: { contrasena: string; id: string }) {
  const extras = typeof window === "undefined" ? [] : window.location.hostname.split(/[.-]/);
  const f = evaluarContrasena(contrasena, extras);
  const llenas = contrasena ? Math.max(1, f.nivel) : 0;
  return (
    <div className="mt-2">
      <div className="flex gap-1" aria-hidden="true">
        {[1, 2, 3, 4].map((n) => (
          <span key={n} className={cx("h-1.5 flex-1 rounded-full", n <= llenas ? COLOR[f.nivel] : "bg-white/10")} />
        ))}
      </div>
      <p id={id} className="mt-1 text-xs text-tenue" aria-live="polite">
        {contrasena ? (
          <>
            <strong className="text-[var(--texto)]">{NOMBRE_NIVEL[f.nivel]}.</strong> {f.problemas[0] ?? "Así está bien."}
          </>
        ) : (
          "Al menos 12 caracteres. Una frase que recuerdes funciona bien; evita palabras comunes y secuencias."
        )}
      </p>
    </div>
  );
}
