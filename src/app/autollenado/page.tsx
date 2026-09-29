import ConectarExtension from "@/features/autollenado/ConectarExtension";
import { Encabezado, EnlaceBoton, Tarjeta } from "@/ui/ui";

export const metadata = { title: "Autollenado" };

const PASOS = [
  { titulo: "Prepara la extensión", texto: "En la carpeta del proyecto ejecuta «npm run extension». Se crea la carpeta extension/dist." },
  { titulo: "Cárgala en Chrome", texto: "Abre chrome://extensions, activa «Modo de desarrollador» (arriba a la derecha) y pulsa «Cargar descomprimida». Elige la carpeta extension/dist." },
  { titulo: "Úsala", texto: "Con EmpleaTech abierta, entra al formulario de una vacante (desde «Abrir formulario» en tu cola de hoy) y pulsa «Llenar con EmpleaTech» en el panel de la esquina." },
];

export default function AutollenadoPage() {
  return (
    <main className="mx-auto max-w-3xl px-5 py-10">
      <Encabezado
        titulo="Autollenado de formularios"
        descripcion="Una extensión de Chrome llena los formularios de Greenhouse, Lever y Ashby con tu perfil, adjunta tu CV y tu carta para esa vacante, y marca en rojo lo que falta. En Workana, Upwork y Freelancer.com arma la propuesta del proyecto que tienes abierto y la pone en su cuadro. Nunca envía: el botón «Enviar» siempre lo presionas tú."
        acciones={<EnlaceBoton variante="secundario" href="/hoy">Ir a mi cola</EnlaceBoton>}
      />
      {process.env.EMPLEATECH_AUTH === "1" && <ConectarExtension />}
      <ol className="space-y-4">
        {PASOS.map((p, i) => (
          <li key={p.titulo}>
            <Tarjeta titulo={`${i + 1}. ${p.titulo}`}>
              <p className="text-sm text-tenue">{p.texto}</p>
            </Tarjeta>
          </li>
        ))}
      </ol>
      <Tarjeta titulo="Qué hace y qué no" className="mt-6">
        <ul className="list-disc space-y-1 pl-5 text-sm text-tenue">
          <li>Llena solo lo que sabe por tu perfil y tus respuestas; nunca sobrescribe lo que ya escribiste.</li>
          <li>No marca casillas de términos ni resuelve captchas: eso es tuyo.</li>
          <li>Cuando envías, registra la postulación en tu tracker y aprende tus respuestas a preguntas nuevas.</li>
          <li>Solo habla con tu EmpleaTech; ninguna página web puede pedirle tus datos.</li>
        </ul>
      </Tarjeta>
    </main>
  );
}
