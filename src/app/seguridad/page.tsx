import Seguridad from "@/features/seguridad/Seguridad";
import { Aviso, Encabezado } from "@/ui/ui";

export const metadata = { title: "Seguridad" };

export default function SeguridadPage() {
  return (
    <main className="mx-auto max-w-3xl px-5 py-10">
      <Encabezado
        titulo="Seguridad"
        descripcion="Quién puede entrar a tu EmpleaTech: tu contraseña, la verificación en dos pasos y las sesiones abiertas."
      />
      {process.env.EMPLEATECH_AUTH === "1" ? (
        <Seguridad />
      ) : (
        <Aviso titulo="En tu computadora no hace falta">
          EmpleaTech solo acepta conexiones de tu propia computadora. La contraseña y la verificación en dos pasos se activan cuando la publicas en internet.
        </Aviso>
      )}
    </main>
  );
}
