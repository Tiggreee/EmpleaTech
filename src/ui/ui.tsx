import Link from "next/link";
import type { ButtonHTMLAttributes, ComponentProps, ReactNode } from "react";

export function cx(...c: (string | false | null | undefined)[]): string {
  return c.filter(Boolean).join(" ");
}

export type Tono = "neutro" | "ok" | "aviso" | "riesgo" | "cian";

const TONO_INSIGNIA: Record<Tono, string> = {
  neutro: "bg-white/10 text-tenue",
  ok: "bg-ok/15 text-ok",
  aviso: "bg-aviso/15 text-aviso",
  riesgo: "bg-riesgo/15 text-riesgo",
  cian: "bg-cian/15 text-cian",
};

export function Insignia({ tono = "neutro", children, title }: { tono?: Tono; children: ReactNode; title?: string }) {
  return (
    <span title={title} className={cx("inline-block whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs", TONO_INSIGNIA[tono])}>
      {children}
    </span>
  );
}

type Variante = "primario" | "secundario" | "peligro";
const VARIANTE: Record<Variante, string> = {
  primario: "boton",
  secundario: "boton boton-sec",
  peligro: "boton boton-sec !text-riesgo !border-riesgo/40",
};

export function Boton({ variante = "primario", pequeno, className, ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { variante?: Variante; pequeno?: boolean }) {
  return <button type="button" className={cx(VARIANTE[variante], pequeno && "!px-2.5 !py-1.5 !text-xs", className)} {...rest} />;
}

export function EnlaceBoton({ variante = "primario", pequeno, className, ...rest }: ComponentProps<typeof Link> & { variante?: Variante; pequeno?: boolean }) {
  return <Link className={cx(VARIANTE[variante], pequeno && "!px-2.5 !py-1.5 !text-xs", className)} {...rest} />;
}

export function Tarjeta({ titulo, acciones, children, className }: { titulo?: string; acciones?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={cx("vidrio p-5", className)}>
      {(titulo || acciones) && (
        <div className="mb-3 flex items-center justify-between gap-3">
          {titulo && <h2 className="font-semibold">{titulo}</h2>}
          {acciones}
        </div>
      )}
      {children}
    </section>
  );
}

const TONO_AVISO: Record<Tono, string> = {
  neutro: "border-white/10 bg-white/5",
  ok: "border-ok/30 bg-ok/10",
  aviso: "border-aviso/30 bg-aviso/10",
  riesgo: "border-riesgo/40 bg-riesgo/10",
  cian: "border-cian/30 bg-cian/10",
};

export function Aviso({ tono = "neutro", titulo, children, className }: { tono?: Tono; titulo?: string; children?: ReactNode; className?: string }) {
  return (
    <div role={tono === "riesgo" ? "alert" : "status"} className={cx("rounded-xl border px-4 py-3 text-sm", TONO_AVISO[tono], className)}>
      {titulo && <p className="font-medium">{titulo}</p>}
      {children && <div className={cx(titulo && "mt-1 text-tenue")}>{children}</div>}
    </div>
  );
}

export function Estadistica({ etiqueta, valor, pista, tono }: { etiqueta: string; valor: ReactNode; pista?: string; tono?: Tono }) {
  return (
    <div className="vidrio px-4 py-3">
      <p className="text-xs text-tenue">{etiqueta}</p>
      <p className={cx("text-2xl font-semibold", tono === "riesgo" && "text-riesgo", tono === "ok" && "text-ok", tono === "aviso" && "text-aviso")}>{valor}</p>
      {pista && <p className="mt-0.5 text-xs text-tenue">{pista}</p>}
    </div>
  );
}

export function Encabezado({ titulo, descripcion, acciones }: { titulo: string; descripcion?: string; acciones?: ReactNode }) {
  return (
    <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">{titulo}</h1>
        {descripcion && <p className="mt-2 max-w-2xl text-sm text-tenue">{descripcion}</p>}
      </div>
      {acciones && <div className="flex flex-wrap gap-2">{acciones}</div>}
    </header>
  );
}

export function Vacio({ titulo, children, accion }: { titulo: string; children?: ReactNode; accion?: ReactNode }) {
  return (
    <div className="rounded-2xl border border-dashed border-white/15 px-6 py-10 text-center">
      <p className="font-medium">{titulo}</p>
      {children && <p className="mx-auto mt-1 max-w-md text-sm text-tenue">{children}</p>}
      {accion && <div className="mt-4 flex justify-center">{accion}</div>}
    </div>
  );
}

export function Anillo({ valor, tamano = 130 }: { valor: number; tamano?: number }) {
  const r = 52;
  const c = 2 * Math.PI * r;
  const color = valor >= 80 ? "var(--ok)" : valor >= 60 ? "var(--cian)" : valor >= 40 ? "var(--aviso)" : "var(--riesgo)";
  return (
    <svg width={tamano} height={tamano} viewBox="0 0 130 130" role="img" aria-label={`Afinidad ${valor} de 100`}>
      <circle cx="65" cy="65" r={r} fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="10" />
      <circle cx="65" cy="65" r={r} fill="none" stroke={color} strokeWidth="10" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - valor / 100)} transform="rotate(-90 65 65)" />
      <text x="65" y="72" textAnchor="middle" fontSize="30" fontWeight="700" fill="currentColor">{valor}</text>
    </svg>
  );
}
