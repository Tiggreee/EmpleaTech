"use client";

import { useEffect, useState, type FormEvent } from "react";
import { pedir } from "@/features/vacantes/cliente";
import { Aviso, Boton, Tarjeta } from "@/ui/ui";

interface EstadoAcceso {
  requerido: boolean;
  configurado: boolean;
  sesion: boolean;
}

/** Solo rutas internas: un enlace «/entrar?volver=https://otro-sitio» no te saca de EmpleaTech. */
function destino(): string {
  const v = new URLSearchParams(window.location.search).get("volver") ?? "";
  return v.startsWith("/") && !v.startsWith("//") && !v.startsWith("/entrar") ? v : "/hoy";
}

export default function Entrar() {
  const [estado, setEstado] = useState<EstadoAcceso | null>(null);
  const [codigo, setCodigo] = useState("");
  const [contrasena, setContrasena] = useState("");
  const [confirmacion, setConfirmacion] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    pedir<EstadoAcceso>("/api/acceso")
      .then((e) => {
        if (!e.requerido || e.sesion) window.location.replace(destino());
        else setEstado(e);
      })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : "No pudimos revisar tu acceso."));
  }, []);

  async function enviar(ev: FormEvent) {
    ev.preventDefault();
    if (!estado) return;
    setError(null);
    if (!estado.configurado && contrasena !== confirmacion) {
      setError("Las contraseñas no coinciden.");
      return;
    }
    setEnviando(true);
    try {
      await pedir("/api/acceso", {
        method: "POST",
        body: JSON.stringify(estado.configurado ? { accion: "entrar", contrasena } : { accion: "crear", codigo, contrasena }),
      });
      // Recarga completa: así la app vuelve a leer tus datos ya con sesión.
      window.location.assign(destino());
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo entrar.");
      setEnviando(false);
    }
  }

  const crear = estado && !estado.configurado;
  return (
    <main className="mx-auto flex max-w-md flex-col px-5 py-16">
      <Tarjeta titulo={crear ? "Crea tu contraseña" : "Entrar a EmpleaTech"}>
        {!estado && !error && <p className="text-sm text-tenue">Revisando tu acceso…</p>}
        {estado && (
          <form className="space-y-4" onSubmit={(e) => void enviar(e)}>
            {crear && (
              <>
                <p className="text-sm text-tenue">Es la primera vez: usa el código de acceso que te di al publicar la app y elige tu contraseña. Solo tú podrás entrar.</p>
                <label className="block text-sm">
                  <span className="mb-1 block font-medium">Código de acceso</span>
                  <input className="campo" value={codigo} onChange={(e) => setCodigo(e.target.value)} autoComplete="one-time-code" required />
                </label>
              </>
            )}
            <div>
              <label className="block text-sm">
                <span className="mb-1 block font-medium">Contraseña</span>
                <input
                  className="campo"
                  type="password"
                  value={contrasena}
                  onChange={(e) => setContrasena(e.target.value)}
                  autoComplete={crear ? "new-password" : "current-password"}
                  minLength={crear ? 12 : undefined}
                  aria-describedby={crear ? "ayuda-contrasena" : undefined}
                  required
                />
              </label>
              {crear && (
                <p id="ayuda-contrasena" className="mt-1 text-xs text-tenue">
                  Al menos 12 caracteres. Una frase que recuerdes funciona bien.
                </p>
              )}
            </div>
            {crear && (
              <label className="block text-sm">
                <span className="mb-1 block font-medium">Repite la contraseña</span>
                <input className="campo" type="password" value={confirmacion} onChange={(e) => setConfirmacion(e.target.value)} autoComplete="new-password" required />
              </label>
            )}
            <Boton type="submit" disabled={enviando}>
              {enviando ? "Entrando…" : crear ? "Crear y entrar" : "Entrar"}
            </Boton>
          </form>
        )}
        {error && (
          <Aviso tono="riesgo" className="mt-4">
            {error}
          </Aviso>
        )}
      </Tarjeta>
    </main>
  );
}
