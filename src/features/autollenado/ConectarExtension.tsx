"use client";

import { useState, useSyncExternalStore } from "react";
import { pedir } from "@/features/vacantes/cliente";
import { Aviso, Boton, Tarjeta } from "@/ui/ui";

const APP = "empleatech-app";
const EXTENSION = "empleatech-extension";
/** Si la extensión no contesta en este tiempo, se dice en vez de quedarse esperando. */
const ESPERA_MS = 5000;

type Respuesta = { fuente: string; tipo: "lista"; version: string } | { fuente: string; tipo: "conectada"; ok: boolean; base?: string; error?: string };

/**
 * Conecta la extensión con un clic: la extensión avisa que está instalada (marca la página) y recibe de aquí la dirección
 * y, si la app vive en internet, un token para demostrar que es tuya. Sin extensión, o en otro navegador, queda el modo
 * a mano: generar el token y pegarlo en las opciones de la extensión.
 */
/**
 * Versión de la extensión instalada, si hay. La extensión avisa con «lista» al cargar y contesta cuando la página pregunta
 * («hola»): así no importa quién cargue primero.
 */
let versionVista: string | null = null;

function suscribir(aviso: () => void) {
  const escuchar = (e: MessageEvent<Respuesta>) => {
    if (e.source !== window || e.origin !== window.location.origin || e.data?.fuente !== EXTENSION || e.data.tipo !== "lista") return;
    versionVista = e.data.version;
    aviso();
  };
  window.addEventListener("message", escuchar);
  window.postMessage({ fuente: APP, tipo: "hola" }, window.location.origin);
  return () => window.removeEventListener("message", escuchar);
}
const versionInstalada = () => versionVista;

export default function ConectarExtension({ conSesion }: { conSesion: boolean }) {
  const version = useSyncExternalStore(suscribir, versionInstalada, () => null);
  const [conectando, setConectando] = useState(false);
  const [conectada, setConectada] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function conectar() {
    setError(null);
    setConectada(null);
    setConectando(true);
    try {
      const token = conSesion ? (await pedir<{ token: string }>("/api/acceso", { method: "POST", body: JSON.stringify({ accion: "token-extension" }) })).token : undefined;
      const base = await new Promise<string>((resolver, rechazar) => {
        const reloj = window.setTimeout(() => {
          window.removeEventListener("message", escuchar);
          rechazar(new Error("La extensión no contestó. Recarga esta página e intenta de nuevo."));
        }, ESPERA_MS);
        function escuchar(e: MessageEvent<Respuesta>) {
          if (e.source !== window || e.origin !== window.location.origin || e.data?.fuente !== EXTENSION || e.data.tipo !== "conectada") return;
          window.clearTimeout(reloj);
          window.removeEventListener("message", escuchar);
          if (e.data.ok && e.data.base) resolver(e.data.base);
          else rechazar(new Error(e.data.error ?? "No se pudo conectar."));
        }
        window.addEventListener("message", escuchar);
        window.postMessage({ fuente: APP, tipo: "conectar", token }, window.location.origin);
      });
      setConectada(base);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo conectar.");
    } finally {
      setConectando(false);
    }
  }

  return (
    <Tarjeta titulo="Conectar la extensión" className="mb-6">
      {version ? (
        <>
          <p className="text-sm text-tenue">
            Extensión {version} instalada en este navegador. Un clic y queda ligada a tu cuenta; no tienes que copiar nada.
          </p>
          <div className="mt-4">
            <Boton onClick={() => void conectar()} disabled={conectando}>
              {conectando ? "Conectando…" : conectada ? "Conectar de nuevo" : "Conectar la extensión"}
            </Boton>
          </div>
        </>
      ) : (
        <p className="text-sm text-tenue">
          No vemos la extensión en este navegador. Instálala con los pasos de abajo y recarga esta página: aquí aparecerá el botón para conectarla.
        </p>
      )}
      {conectada && (
        <Aviso tono="ok" className="mt-3">
          Conectada a {conectada}. Abre el formulario de una vacante y pulsa «Llenar con EmpleaTech».
        </Aviso>
      )}
      {error && (
        <Aviso tono="riesgo" className="mt-3">
          {error}
        </Aviso>
      )}
      {conSesion && <ConexionAMano />}
    </Tarjeta>
  );
}

/** Para otro navegador o si el clic no funciona: el token se genera aquí y se pega en las opciones de la extensión. */
function ConexionAMano() {
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
    <details className="mt-5 border-t border-linea pt-4">
      <summary className="cursor-pointer font-mono text-xs uppercase tracking-widest text-tenue">Conectarla a mano</summary>
      <ol className="mt-3 list-decimal space-y-1 pl-5 text-sm text-tenue">
        <li>Genera tu token (dura un año; genera otro cuando quieras).</li>
        <li>
          En Chrome, clic derecho en el ícono de EmpleaTech → <strong>Opciones</strong>. Pega la dirección <strong className="text-texto">{direccion}</strong> y el token, y guarda.
        </li>
      </ol>
      <p className="mt-2 text-xs text-tenue">Si cambias tu contraseña, activas la verificación en dos pasos o cierras sesión en todos lados, la extensión se desconecta: vuelve a conectarla.</p>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Boton variante="secundario" onClick={() => void generar()}>
          {token ? "Generar otro" : "Generar token"}
        </Boton>
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
    </details>
  );
}
