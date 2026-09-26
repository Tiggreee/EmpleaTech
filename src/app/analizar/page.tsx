import { APP_NAME } from "@/config/app";
import Analizar from "@/features/analizar/Analizar";

export const metadata = { title: `Analizar una oferta — ${APP_NAME}` };

export default function AnalizarPage() {
  return <Analizar />;
}

