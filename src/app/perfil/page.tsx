import { APP_NAME } from "@/config/app";
import MiPerfil from "@/features/perfil/MiPerfil";

export const metadata = { title: `Mi perfil — ${APP_NAME}` };

export default function PerfilPage() {
  return <MiPerfil />;
}
