"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { APP_NAME } from "@/config/app";

interface EventoInstalacion extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

function suscribirConexion(cb: () => void) {
  window.addEventListener("online", cb);
  window.addEventListener("offline", cb);
  return () => {
    window.removeEventListener("online", cb);
    window.removeEventListener("offline", cb);
  };
}

export default function PwaBarra() {
  const enLinea = useSyncExternalStore(suscribirConexion, () => navigator.onLine, () => true);
  const [instalar, setInstalar] = useState<EventoInstalacion | null>(null);

  useEffect(() => {
    if (process.env.NODE_ENV === "production" && "serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => undefined);
    }
    const antes = (e: Event) => {
      e.preventDefault();
      setInstalar(e as EventoInstalacion);
    };
    const instalada = () => setInstalar(null);
    window.addEventListener("beforeinstallprompt", antes);
    window.addEventListener("appinstalled", instalada);
    return () => {
      window.removeEventListener("beforeinstallprompt", antes);
      window.removeEventListener("appinstalled", instalada);
    };
  }, []);

  return (
    <>
      {!enLinea && (
        <div role="status" className="border-b border-aviso/30 bg-aviso/10 px-5 py-2 text-center text-xs">
          Sin internet. Si tu entorno local sigue encendido, todavía puedes abrir {APP_NAME} y revisar tu información.
        </div>
      )}
      {instalar && (
        <div className="border-b border-white/10 bg-white/5 px-5 py-2 text-center text-xs">
          <span className="text-tenue">Instala {APP_NAME} como app para abrirla más rápido. </span>
          <button
            className="font-medium text-cian underline underline-offset-4"
            onClick={async () => {
              await instalar.prompt();
              setInstalar(null);
            }}
          >
            Instalar
          </button>
        </div>
      )}
    </>
  );
}

