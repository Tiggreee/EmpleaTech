import Link from "next/link";
import { APP_NAME } from "@/config/app";

const VENTAJAS = [
  { t: "Importa tu CV en PDF o Word", d: "Súbelo o pégalo, revisa qué entendió la app y conserva varias versiones." },
  { t: "Afinidad que se explica", d: "Cada coincidencia cita evidencia del CV y de la oferta. No hay cajas negras." },
  { t: "Radar de riesgos", d: "Detecta cobros, solo comisión, datos sensibles y patrones típicos de fraude o abuso." },
  { t: "Tracker con prioridad y seguimiento", d: "Ordena ofertas, toma notas, marca el sello humano y revisa qué hacer hoy." },
  { t: "Base de datos local", d: "CVs, ofertas y postulaciones se guardan en Postgres local para que después puedas consultar y exportar tu propio dataset." },
  { t: "Sin cuenta, sin nube obligatoria", d: "Todo corre en tu equipo para que valides utilidad antes de pensar en despliegues o monetización." },
];

const PASOS = [
  "Levanta Postgres local una vez",
  "Guarda tu CV y analiza ofertas reales",
  "Mide afinidad, brechas y alertas",
  "Guarda solo lo que quieras seguir",
  "Consulta tu avance desde panel y tracker",
];

export default function Inicio() {
  return (
    <main className="mx-auto max-w-6xl px-5 py-16 sm:py-24">
      <section className="max-w-3xl">
        <p className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-tenue">
          <span className="h-1.5 w-1.5 rounded-full bg-ok" /> Full-stack local · Postgres · Sin cuenta
        </p>
        <h1 className="text-4xl font-semibold tracking-tight sm:text-6xl">
          Convierte tu búsqueda en un <span className="gradiente-texto">proceso medible</span>.
        </h1>
        <p className="mt-6 max-w-2xl text-lg text-tenue">
          {APP_NAME} es un MVP para probar con tu CV y vacantes reales si un asistente personal de búsqueda de empleo te ayuda de verdad: análisis explicable, radar de riesgos y seguimiento persistente.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link href="/panel" className="boton">Abrir panel</Link>
          <Link href="/analizar" className="boton boton-sec">Analizar una oferta</Link>
        </div>
      </section>

      <section className="mt-20" aria-labelledby="ventajas">
        <h2 id="ventajas" className="mb-6 text-sm font-medium uppercase tracking-widest text-tenue">Qué incluye este MVP</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {VENTAJAS.map((v) => (
            <article key={v.t} className="vidrio p-5">
              <h3 className="mb-2 font-semibold">{v.t}</h3>
              <p className="text-sm leading-relaxed text-tenue">{v.d}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="mt-20" aria-labelledby="flujo">
        <h2 id="flujo" className="mb-6 text-sm font-medium uppercase tracking-widest text-tenue">Flujo sugerido</h2>
        <ol className="grid gap-3 sm:grid-cols-5">
          {PASOS.map((p, i) => (
            <li key={p} className="vidrio p-4 text-sm">
              <span className="gradiente-texto mb-2 block text-2xl font-semibold">{i + 1}</span>
              {p}
            </li>
          ))}
        </ol>
        <p className="mt-6 text-sm text-tenue">
          También puedes revisar la comparativa con otras herramientas en <Link href="/inteligencia" className="text-cian underline underline-offset-4">Inteligencia</Link> para ver qué sí hace la app y qué sigue pendiente.
        </p>
      </section>
    </main>
  );
}

