import Link from "next/link";

const PASOS = [
  { t: "Sube tu CV", d: "PDF, Word o texto. Revisas lo que entendió y lo corriges si hace falta." },
  { t: "Busca por ti", d: "Cada día trae vacantes y proyectos de las plataformas que elijas, sin duplicados." },
  { t: "Ordena contra tu CV", d: "Cada vacante dice qué requisitos cubres, qué te falta y si huele a fraude." },
  { t: "Te prepara el envío", d: "CV y carta a la medida de esa vacante, sin inventar nada que no esté en tu CV." },
  { t: "Tú envías", d: "La extensión llena el formulario; el botón «Enviar» siempre lo presionas tú." },
];

export default function Inicio() {
  return (
    <main className="mx-auto max-w-6xl px-5 py-12 sm:py-20">
      <section className="border-b-2 border-texto pb-12">
        <p className="font-mono text-xs uppercase tracking-widest text-tenue">Asistente personal de búsqueda de empleo</p>
        <h1 className="mt-4 max-w-5xl text-5xl font-black leading-[0.88] tracking-[-0.05em] sm:text-7xl lg:text-8xl">
          Menos búsqueda. <span className="text-cian">Más resultados.</span>
        </h1>
        <p className="mt-6 max-w-2xl text-lg text-tenue sm:text-xl">
          Cada mañana tienes las vacantes que mejor encajan con tu CV, cada una con su CV y su carta listos. Tú revisas y envías.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link href="/hoy" className="boton">
            Ver mis vacantes de hoy →
          </Link>
          <Link href="/analizar" className="boton boton-sec">
            Analizar una oferta
          </Link>
        </div>
      </section>

      <section aria-labelledby="como" className="mt-12">
        <h2 id="como" className="font-mono text-xs uppercase tracking-widest text-tenue">
          Cómo funciona
        </h2>
        <ol className="mt-4 border-t border-texto">
          {PASOS.map((p, i) => (
            <li key={p.t} className="grid grid-cols-[4rem_minmax(0,1fr)] gap-4 border-b border-texto py-6 sm:grid-cols-[6rem_minmax(0,18rem)_minmax(0,1fr)] sm:gap-8">
              <span aria-hidden="true" className="contorno text-5xl font-black leading-[0.8] tracking-[-0.05em] sm:text-6xl">
                {String(i + 1).padStart(2, "0")}
              </span>
              <h3 className="text-2xl font-extrabold tracking-tight">{p.t}</h3>
              <p className="col-start-2 text-tenue sm:col-start-auto sm:text-lg">{p.d}</p>
            </li>
          ))}
        </ol>
        <p className="mt-8 text-sm text-tenue">
          ¿Qué hace distinto a otras herramientas? Está en{" "}
          <Link href="/inteligencia" className="font-semibold text-texto underline underline-offset-4">
            Inteligencia
          </Link>
          .
        </p>
      </section>
    </main>
  );
}
