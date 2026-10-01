"use client";

import { useState } from "react";
import { pedir } from "@/features/vacantes/cliente";
import { Aviso, Boton, Tarjeta } from "@/ui/ui";

/** Cuando EmpleaTech vive en internet, la extensión necesita la dirección y un token para demostrar que es tuya. */
export default function ConectarExtension() {
  const [token, setToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copiado, setCopiado] = useState(false);
  const direccion = typeof window === "undefined" ? "" : window.location.origin;

  async function generar() {
    setError(null);
    try {
      const r = await pedir<{ token: string }>("/api/acceso", { method: "POST", body: JSON.stringify({ accion: "token-extension" }) });
      setToken(r.token);
      setCopiado(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo generar el token.");
    }
  }

  return (
    <Tarjeta titulo="Conectar la extensión" className="mb-6">
      <ol className="list-decimal space-y-1 pl-5 text-sm text-tenue">
        <li>Genera tu token (dura un año; genera otro cuando quieras).</li>
        <li>
          En Chrome, clic derecho en el ícono de EmpleaTech → <strong>Opciones</strong>. Pega la dirección <strong className="text-[var(--texto)]">{direccion}</strong> y el token, y guarda.
        </li>
        <li>Chrome te pedirá permiso para hablar con esa dirección: acéptalo.</li>
      </ol>
      <p className="mt-2 text-xs text-tenue">Si cambias tu contraseña, activas la verificación en dos pasos o cierras sesión en todos lados, la extensión se desconecta: genera un token nuevo.</p>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Boton onClick={() => void generar()}>{token ? "Generar otro" : "Generar token"}</Boton>
        {token && (
          <Boton
            variante="secundario"
            onClick={() => {
              void navigator.clipboard.writeText(token).then(() => setCopiado(true));
            }}
          >
            {copiado ? "Copiado" : "Copiar token"}
          </Boton>
        )}
      </div>
      {token && <input readOnly aria-label="Token de conexión" className="campo mt-3 font-mono text-xs" value={token} onFocus={(e) => e.currentTarget.select()} />}
      {error && (
        <Aviso tono="riesgo" className="mt-3">
          {error}
        </Aviso>
      )}
    </Tarjeta>
  );
}
