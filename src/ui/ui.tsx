import Link from "next/link";
import type { ButtonHTMLAttributes, ComponentProps, ReactNode } from "react";

export function cx(...c: (string | false | null | undefined)[]): string {
  return c.filter(Boolean).join(" ");
}

export type Tono = "neutro" | "ok" | "aviso" | "riesgo" | "cian";

const TONO_INSIGNIA: Record<Tono, string> = {
  neutro: "border-linea bg-superficie text-texto",
  ok: "border-ok/40 bg-ok/10 text-ok",
  aviso: "border-aviso/40 bg-aviso/10 text-aviso",
  riesgo: "border-riesgo/40 bg-riesgo/10 text-riesgo",
  cian: "border-cian/40 bg-cian/10 text-cian",
};

export function Insignia({ tono = "neutro", children, title }: { tono?: Tono; children: ReactNode; title?: string }) {
  return (
    <span title={title} className={cx("inline-block whitespace-nowrap border px-2 py-0.5 font-mono text-[11px] uppercase tracking-wide", TONO_INSIGNIA[tono])}>
      {children}
    </span>
  );
}

type Variante = "primario" | "secundario" | "peligro";
const VARIANTE: Record<Variante, string> = {
  primario: "boton",
  secundario: "boton boton-sec",
  peligro: "boton boton-sec !text-riesgo !border-riesgo hover:!bg-riesgo hover:!text-white",
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
          {titulo && <h2 className="text-lg font-extrabold tracking-tight">{titulo}</h2>}
          {acciones}
        </div>
      )}
      {children}
    </section>
  );
}

const TONO_AVISO: Record<Tono, string> = {
  neutro: "border-texto bg-papel",
  ok: "border-ok bg-ok/10",
  aviso: "border-aviso bg-aviso/10",
  riesgo: "border-riesgo bg-riesgo/10",
  cian: "border-cian bg-cian/10",
};

export function Aviso({ tono = "neutro", titulo, children, className }: { tono?: Tono; titulo?: string; children?: ReactNode; className?: string }) {
  return (
    <div role={tono === "riesgo" ? "alert" : "status"} className={cx("border-l-4 px-4 py-3 text-sm", TONO_AVISO[tono], className)}>
      {titulo && <p className="font-bold">{titulo}</p>}
      {children && <div className={cx(titulo && "mt-1 text-tenue")}>{children}</div>}
    </div>
  );
}

export function Estadistica({ etiqueta, valor, pista, tono }: { etiqueta: string; valor: ReactNode; pista?: string; tono?: Tono }) {
  return (
    <div className="vidrio px-4 py-3">
      <p className="font-mono text-[11px] uppercase tracking-wider text-tenue">{etiqueta}</p>
      <p className={cx("mt-1 text-4xl font-black tracking-tight", tono === "riesgo" && "text-riesgo", tono === "ok" && "text-ok", tono === "aviso" && "text-aviso")}>{valor}</p>
      {pista && <p className="mt-0.5 text-xs text-tenue">{pista}</p>}
    </div>
  );
}

export function Encabezado({ titulo, descripcion, acciones }: { titulo: string; descripcion?: string; acciones?: ReactNode }) {
  return (
    <header className="mb-10 flex flex-wrap items-end justify-between gap-6 border-b-2 border-texto pb-6">
      <div>
        <h1 className="text-4xl font-black leading-[0.92] tracking-[-0.045em] sm:text-6xl lg:text-7xl">{titulo}</h1>
        {descripcion && <p className="mt-4 max-w-2xl text-base text-tenue sm:text-lg">{descripcion}</p>}
      </div>
      {acciones && <div className="flex flex-wrap gap-2">{acciones}</div>}
    </header>
  );
}

export function Vacio({ titulo, children, accion }: { titulo: string; children?: ReactNode; accion?: ReactNode }) {
  return (
    <div className="border-2 border-dashed border-texto/40 px-6 py-12 text-center">
      <p className="text-2xl font-black tracking-tight">{titulo}</p>
      {children && <p className="mx-auto mt-1 max-w-md text-sm text-tenue">{children}</p>}
      {accion && <div className="mt-4 flex justify-center">{accion}</div>}
    </div>
  );
}

/** Afinidad en grande: cuadro negro con el número y una barra naranja de 0 a 100. */
export function Anillo({ valor, tamano = 130 }: { valor: number; tamano?: number }) {
  return (
    <div role="img" aria-label={`Afinidad ${valor} de 100`} className="flex shrink-0 flex-col items-center justify-center bg-texto text-fondo" style={{ width: tamano, height: tamano }}>
      <span className="font-black leading-none tracking-tight" style={{ fontSize: Math.round(tamano * 0.38) }}>
        {valor}
      </span>
      <span className="mt-1 font-mono text-[10px] uppercase tracking-widest text-linea">de 100</span>
      <span aria-hidden="true" className="mt-2 block h-1.5 w-2/3 bg-fondo/20">
        <span className="block h-full bg-naranja" style={{ width: `${Math.max(0, Math.min(100, valor))}%` }} />
      </span>
    </div>
  );
}

/** Puntaje compacto para las filas de vacantes. */
export function Puntaje({ valor, etiqueta = "afinidad", tamano = 84 }: { valor: number | null; etiqueta?: string; tamano?: number }) {
  return (
    <div className="flex shrink-0 flex-col items-center justify-center bg-texto text-fondo" style={{ width: tamano, height: tamano }}>
      <span className="font-black leading-none tracking-tight" style={{ fontSize: Math.round(tamano * 0.42) }}>
        {valor ?? "—"}
      </span>
      <span className="mt-1 font-mono text-[10px] uppercase tracking-widest text-linea">{etiqueta}</span>
    </div>
  );
}

/** Requisitos cubiertos como bloques: uno por requisito, naranja los que ya tienes. El texto va aparte, en claro. */
export function Bloques({ cubiertas, total, max = 24 }: { cubiertas: number; total: number; max?: number }) {
  if (total <= 0) return null;
  // Con muchos requisitos se escala a `max` bloques para que la fila no se desborde.
  const n = Math.min(total, max);
  const llenos = Math.round((cubiertas / total) * n);
  return (
    <span aria-hidden="true" className="flex flex-wrap gap-[3px]">
      {Array.from({ length: n }, (_, i) => (
        <span key={i} className={cx("h-4 w-2.5", i < llenos ? "bg-naranja" : "bg-linea")} />
      ))}
    </span>
  );
}
