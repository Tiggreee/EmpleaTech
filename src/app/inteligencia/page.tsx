import { APP_NAME } from "@/config/app";
import { ETIQUETA_VALOR, FILAS, PENDIENTES, type Valor } from "@/content/inteligencia";

export const metadata = { title: `Inteligencia — ${APP_NAME}` };

const CLASE: Record<Valor, string> = {
  si: "bg-ok/15 text-ok",
  no: "bg-riesgo/15 text-riesgo",
  parcial: "bg-aviso/15 text-aviso",
  sd: "bg-white/10 text-tenue",
};

function Celda({ v }: { v: Valor }) {
  return <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs ${CLASE[v]}`}>{ETIQUETA_VALOR[v]}</span>;
}

export default function InteligenciaPage() {
  return (
    <main className="mx-auto max-w-6xl px-5 py-10">
      <h1 className="text-3xl font-semibold tracking-tight">Inteligencia competitiva, con fuentes</h1>
      <p className="mt-2 max-w-3xl text-sm text-tenue">
        Comparamos {APP_NAME} con Jobright, Simplify y Torre usando solo lo que pudimos verificar. «Sin verificar» significa que no tenemos evidencia, no que la herramienta carezca de la función.
      </p>

      <div className="mt-8 overflow-x-auto">
        <table className="w-full min-w-[820px] text-left text-sm">
          <caption className="sr-only">Comparativa de capacidades</caption>
          <thead className="text-xs uppercase tracking-wide text-tenue">
            <tr>
              <th scope="col" className="py-2 pr-3">Capacidad</th>
              <th scope="col" className="pr-3 text-cian">{APP_NAME}</th>
              <th scope="col" className="pr-3">Jobright</th>
              <th scope="col" className="pr-3">Simplify</th>
              <th scope="col" className="pr-3">Torre</th>
              <th scope="col">Fuente</th>
            </tr>
          </thead>
          <tbody>
            {FILAS.map((f) => (
              <tr key={f.capacidad} className="border-t border-white/10 align-top">
                <th scope="row" className="py-3 pr-3 font-medium">{f.capacidad}</th>
                <td className="pr-3"><Celda v={f.app} /></td>
                <td className="pr-3"><Celda v={f.jobright} /></td>
                <td className="pr-3"><Celda v={f.simplify} /></td>
                <td className="pr-3"><Celda v={f.torre} /></td>
                <td className="py-3 text-xs text-tenue">{f.fuente}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <section className="vidrio mt-10 p-5">
        <h2 className="mb-3 font-semibold">Lo que todavía no hace</h2>
        <ul className="list-disc space-y-1.5 pl-5 text-sm text-tenue">
          {PENDIENTES.map((p) => <li key={p}>{p}</li>)}
        </ul>
      </section>

      <p className="mt-6 text-xs text-tenue">
        Método: el recon consulta solo páginas públicas permitidas por el robots.txt de cada sitio, con un User-Agent identificable, y no guarda HTML ni código de terceros.
      </p>
      <p className="mt-3 text-xs text-tenue">
        La información de competidores corresponde al recon del 18 de septiembre de 2026 y puede haber cambiado desde entonces.
      </p>
    </main>
  );
}

