import { APP_NAME } from "@/config/app";
import Postulaciones from "@/features/postulaciones/Postulaciones";

export const metadata = { title: `Mis postulaciones — ${APP_NAME}` };

export default function PostulacionesPage() {
  return <Postulaciones />;
}

