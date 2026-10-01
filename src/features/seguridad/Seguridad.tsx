"use client";

import { useCallback, useEffect, useState, type FormEvent, type ReactNode } from "react";
import { evaluarContrasena } from "@/core/acceso/fuerza";
import Medidor from "@/features/acceso/Medidor";
import { pedir } from "@/features/vacantes/cliente";
import { Aviso, Boton, Insignia, Tarjeta } from "@/ui/ui";
import Qr from "./Qr";

interface Estado {
  dosPasos: boolean;
  codigosRestantes: number;
}

const mensaje = (e: unknown, otro: string) => (e instanceof Error ? e.message : otro);
const post = <T,>(datos: Record<string, unknown>) => pedir<T>("/api/seguridad", { method: "POST", body: JSON.stringify(datos) });

function Campo({ etiqueta, children }: { etiqueta: string; children: ReactNode }) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block font-medium">{etiqueta}</span>
      {children}
    </label>
  );
}

function CampoCodigo({ valor, cambiar, etiqueta = "Código de tu app o de respaldo" }: { valor: string; cambiar: (v: string) => void; etiqueta?: string }) {
  return (
    <Campo etiqueta={etiqueta}>
      <input className="campo font-mono" value={valor} onChange={(e) => cambiar(e.target.value)} autoComplete="one-time-code" spellCheck={false} required />
    </Campo>
  );
}

/** Se muestran una sola vez: el servidor solo guarda su huella. */
function CodigosRespaldo({ codigos, listo }: { codigos: string[]; listo: () => void }) {
  const [copiado, setCopiado] = useState(false);
  return (
    <div className="space-y-3">
      <Aviso tono="aviso" titulo="Guarda estos códigos de respaldo ahora">
        Si pierdes el teléfono, cada uno te deja entrar una vez. Guárdalos en tu gestor de contraseñas o imprímelos: no los volverás a ver.
      </Aviso>
      <ul className="grid grid-cols-2 gap-2 font-mono text-sm" aria-label="Códigos de respaldo">
        {codigos.map((c) => (
          <li key={c} className="rounded-lg bg-white/5 px-3 py-2 text-center">
            {c}
          </li>
        ))}
      </ul>
      <div className="flex flex-wrap gap-2">
        <Boton variante="secundario" onClick={() => void navigator.clipboard.writeText(codigos.join("\n")).then(() => setCopiado(true))}>
          {copiado ? "Copiados" : "Copiar códigos"}
        </Boton>
        <Boton onClick={listo}>Ya los guardé</Boton>
      </div>
    </div>
  );
}

type Paso =
  | { tipo: "inicio" }
  | { tipo: "contrasena" }
  | { tipo: "escanear"; secreto: string; uri: string }
  | { tipo: "codigos"; codigos: string[] }
  | { tipo: "desactivar" }
  | { tipo: "nuevos" };

function DosPasos({ estado, recargar }: { estado: Estado; recargar: () => void }) {
  const [paso, setPaso] = useState<Paso>({ tipo: "inicio" });
  const [contrasena, setContrasena] = useState("");
  const [codigo, setCodigo] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  const ir = (p: Paso) => {
    setPaso(p);
    setError(null);
    setCodigo("");
    setContrasena("");
  };

  async function enviar(ev: FormEvent, accion: () => Promise<void>) {
    ev.preventDefault();
    setError(null);
    setEnviando(true);
    try {
      await accion();
    } catch (e) {
      setError(mensaje(e, "No se pudo completar."));
    } finally {
      setEnviando(false);
    }
  }

  const botones = (principal: ReactNode) => (
    <div className="flex gap-2">
      {principal}
      <Boton variante="secundario" onClick={() => ir({ tipo: "inicio" })}>
        Cancelar
      </Boton>
    </div>
  );

  return (
    <Tarjeta className="mb-6">
      <h2 className="mb-3 flex items-center gap-2 font-semibold">
        Verificación en dos pasos <Insignia tono={estado.dosPasos ? "ok" : "aviso"}>{estado.dosPasos ? "Activa" : "Inactiva"}</Insignia>
      </h2>

      {paso.tipo === "inicio" && (
        <div className="space-y-3 text-sm text-tenue">
          {estado.dosPasos ? (
            <>
              <p>Al entrar te pedimos tu contraseña y el código de 6 dígitos de tu app de autenticación. Te quedan {estado.codigosRestantes} códigos de respaldo.</p>
              <div className="flex flex-wrap gap-2">
                <Boton variante="secundario" onClick={() => ir({ tipo: "nuevos" })}>
                  Generar códigos de respaldo nuevos
                </Boton>
                <Boton variante="peligro" onClick={() => ir({ tipo: "desactivar" })}>
                  Desactivar
                </Boton>
              </div>
            </>
          ) : (
            <>
              <p>
                Aunque alguien adivine o robe tu contraseña, sin tu teléfono no entra. Necesitas una app de autenticación: Google Authenticator, Microsoft Authenticator,
                1Password o la que ya uses.
              </p>
              <Boton onClick={() => ir({ tipo: "contrasena" })}>Activar</Boton>
            </>
          )}
        </div>
      )}

      {paso.tipo === "contrasena" && (
        <form
          className="space-y-4"
          onSubmit={(ev) =>
            void enviar(ev, async () => {
              const r = await post<{ secreto: string; uri: string }>({ accion: "preparar-2fa", contrasena });
              ir({ tipo: "escanear", ...r });
            })
          }
        >
          <Campo etiqueta="Tu contraseña actual">
            <input className="campo" type="password" value={contrasena} onChange={(e) => setContrasena(e.target.value)} autoComplete="current-password" required />
          </Campo>
          {botones(
            <Boton type="submit" disabled={enviando}>
              Continuar
            </Boton>,
          )}
        </form>
      )}

      {paso.tipo === "escanear" && (
        <form
          className="space-y-4"
          onSubmit={(ev) =>
            void enviar(ev, async () => {
              const r = await post<{ codigos: string[] }>({ accion: "activar-2fa", codigo });
              ir({ tipo: "codigos", codigos: r.codigos });
              recargar();
            })
          }
        >
          <ol className="list-decimal space-y-1 pl-5 text-sm text-tenue">
            <li>En tu app de autenticación, agrega una cuenta y escanea este código.</li>
            <li>Escribe el código de 6 dígitos que te muestra para confirmar.</li>
          </ol>
          <div className="flex flex-wrap items-center gap-5">
            <Qr texto={paso.uri} />
            <div className="text-sm">
              <p className="text-tenue">¿No puedes escanear? Escribe esta clave:</p>
              <p className="mt-1 break-all font-mono" data-clave-totp>
                {paso.secreto}
              </p>
            </div>
          </div>
          <Campo etiqueta="Código de 6 dígitos">
            <input
              className="campo font-mono"
              value={codigo}
              onChange={(e) => setCodigo(e.target.value)}
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={7}
              required
            />
          </Campo>
          {botones(
            <Boton type="submit" disabled={enviando}>
              Confirmar y activar
            </Boton>,
          )}
        </form>
      )}

      {paso.tipo === "codigos" && (
        <div className="space-y-3">
          <Aviso tono="ok">Listo. Cerramos tus otras sesiones; si usas la extensión, genera un token nuevo en Autollenado.</Aviso>
          <CodigosRespaldo codigos={paso.codigos} listo={() => ir({ tipo: "inicio" })} />
        </div>
      )}

      {paso.tipo === "nuevos" && (
        <form
          className="space-y-4"
          onSubmit={(ev) =>
            void enviar(ev, async () => {
              const r = await post<{ codigos: string[] }>({ accion: "nuevos-codigos", codigo });
              ir({ tipo: "codigos", codigos: r.codigos });
              recargar();
            })
          }
        >
          <p className="text-sm text-tenue">Los códigos de respaldo que tienes dejarán de servir.</p>
          <CampoCodigo valor={codigo} cambiar={setCodigo} etiqueta="Código de tu app de autenticación" />
          {botones(
            <Boton type="submit" disabled={enviando}>
              Generar
            </Boton>,
          )}
        </form>
      )}

      {paso.tipo === "desactivar" && (
        <form
          className="space-y-4"
          onSubmit={(ev) =>
            void enviar(ev, async () => {
              await post({ accion: "desactivar-2fa", contrasena, codigo });
              ir({ tipo: "inicio" });
              recargar();
            })
          }
        >
          <p className="text-sm text-tenue">Sin la verificación en dos pasos, tu contraseña vuelve a ser lo único que protege tus datos.</p>
          <Campo etiqueta="Tu contraseña actual">
            <input className="campo" type="password" value={contrasena} onChange={(e) => setContrasena(e.target.value)} autoComplete="current-password" required />
          </Campo>
          <CampoCodigo valor={codigo} cambiar={setCodigo} />
          {botones(
            <Boton type="submit" variante="peligro" disabled={enviando}>
              Desactivar
            </Boton>,
          )}
        </form>
      )}

      {error && (
        <Aviso tono="riesgo" className="mt-4">
          {error}
        </Aviso>
      )}
    </Tarjeta>
  );
}

function CambiarContrasena() {
  const [actual, setActual] = useState("");
  const [nueva, setNueva] = useState("");
  const [repetida, setRepetida] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [listo, setListo] = useState(false);
  const [enviando, setEnviando] = useState(false);

  async function enviar(ev: FormEvent) {
    ev.preventDefault();
    setError(null);
    setListo(false);
    const fuerza = evaluarContrasena(nueva, window.location.hostname.split(/[.-]/));
    if (!fuerza.valida) return setError(fuerza.problemas[0]);
    if (nueva !== repetida) return setError("Las contraseñas nuevas no coinciden.");
    setEnviando(true);
    try {
      await post({ accion: "cambiar-contrasena", actual, nueva });
      setActual("");
      setNueva("");
      setRepetida("");
      setListo(true);
    } catch (e) {
      setError(mensaje(e, "No se pudo cambiar."));
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Tarjeta titulo="Cambiar contraseña" className="mb-6">
      <form className="space-y-4" onSubmit={(ev) => void enviar(ev)}>
        <Campo etiqueta="Contraseña actual">
          <input className="campo" type="password" value={actual} onChange={(e) => setActual(e.target.value)} autoComplete="current-password" required />
        </Campo>
        <div>
          <Campo etiqueta="Contraseña nueva">
            <input
              className="campo"
              type="password"
              value={nueva}
              onChange={(e) => setNueva(e.target.value)}
              autoComplete="new-password"
              aria-describedby="fuerza-nueva"
              required
            />
          </Campo>
          <Medidor contrasena={nueva} id="fuerza-nueva" />
        </div>
        <Campo etiqueta="Repite la contraseña nueva">
          <input className="campo" type="password" value={repetida} onChange={(e) => setRepetida(e.target.value)} autoComplete="new-password" required />
        </Campo>
        <Boton type="submit" disabled={enviando}>
          {enviando ? "Guardando…" : "Cambiar contraseña"}
        </Boton>
      </form>
      {listo && (
        <Aviso tono="ok" className="mt-4">
          Listo. Cerramos tus otras sesiones; si usas la extensión, genera un token nuevo en Autollenado.
        </Aviso>
      )}
      {error && (
        <Aviso tono="riesgo" className="mt-4">
          {error}
        </Aviso>
      )}
    </Tarjeta>
  );
}

function CerrarSesiones() {
  const [resultado, setResultado] = useState<{ ok: boolean; texto: string } | null>(null);
  return (
    <Tarjeta titulo="Sesiones abiertas">
      <p className="mb-3 text-sm text-tenue">
        ¿Entraste desde una computadora prestada o perdiste un dispositivo? Cierra todas las sesiones menos esta. La extensión también se desconecta.
      </p>
      <Boton
        variante="peligro"
        onClick={() =>
          void post({ accion: "cerrar-sesiones" })
            .then(() => setResultado({ ok: true, texto: "Listo: solo queda abierta esta sesión." }))
            .catch((e: unknown) => setResultado({ ok: false, texto: mensaje(e, "No se pudo.") }))
        }
      >
        Cerrar sesión en todos lados
      </Boton>
      {resultado && (
        <Aviso tono={resultado.ok ? "ok" : "riesgo"} className="mt-4">
          {resultado.texto}
        </Aviso>
      )}
    </Tarjeta>
  );
}

export default function Seguridad() {
  const [estado, setEstado] = useState<Estado | null>(null);
  const [error, setError] = useState<string | null>(null);

  const recargar = useCallback(() => {
    pedir<Estado>("/api/seguridad")
      .then(setEstado)
      .catch((e: unknown) => setError(mensaje(e, "No pudimos leer tu configuración.")));
  }, []);
  useEffect(recargar, [recargar]);

  if (error) return <Aviso tono="riesgo">{error}</Aviso>;
  if (!estado) return <p className="text-sm text-tenue">Cargando…</p>;
  return (
    <>
      <DosPasos estado={estado} recargar={recargar} />
      <CambiarContrasena />
      <CerrarSesiones />
    </>
  );
}
