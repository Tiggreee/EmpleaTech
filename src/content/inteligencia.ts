import { APP_NAME } from "@/config/app";

export type Valor = "si" | "no" | "parcial" | "sd";

export interface Fila {
  capacidad: string;
  app: Valor;
  jobright: Valor;
  simplify: Valor;
  torre: Valor;
  fuente: string;
}

export const ETIQUETA_VALOR: Record<Valor, string> = {
  si: "Sí",
  no: "No",
  parcial: "Parcial",
  sd: "Sin verificar",
};

export const FILAS: Fila[] = [
  { capacidad: "Seguimiento de postulaciones", app: "si", jobright: "si", simplify: "si", torre: "sd", fuente: `${APP_NAME}: src/core/seguimiento y src/features/postulaciones. Otros: rutas /jobs/applied (Jobright) y tracker nativo (Simplify) vistas en el recon.` },
  { capacidad: "Importar CV desde archivo", app: "si", jobright: "si", simplify: "sd", torre: "sd", fuente: `${APP_NAME}: PDF, DOCX, ODT y TXT en src/features/cv, con perfil estructurado (JSON Resume) en src/core/perfil. Jobright: ruta onboarding-v3/resume-upload vista en el recon.` },
  { capacidad: "Autocompletado en portales de empleo", app: "no", jobright: "si", simplify: "si", torre: "sd", fuente: `Páginas públicas job-autofill (Jobright) y extensión (Simplify). ${APP_NAME}: todavía no.` },
  { capacidad: "IA generativa integrada", app: "no", jobright: "si", simplify: "si", torre: "sd", fuente: `Páginas públicas de IA integrada observadas en el recon. ${APP_NAME} sigue usando lógica determinista local.` },
  { capacidad: "API pública / integración programática", app: "no", jobright: "sd", simplify: "sd", torre: "si", fuente: `Página torre.ai/api observada en el recon. ${APP_NAME} aún no expone una API pública estable.` },
  { capacidad: "Lado empleador (reclutadores)", app: "no", jobright: "sd", simplify: "parcial", torre: "si", fuente: `Ruta /recruiter en robots de Simplify; oferta B2B de Torre en su web.` },
  { capacidad: "Afinidad explicada con evidencia por habilidad", app: "si", jobright: "sd", simplify: "sd", torre: "sd", fuente: `${APP_NAME}: src/core/analisis + tests. Competidores: no verificamos cómo calculan su puntaje.` },
  { capacidad: "Habilidades transferibles con crédito parcial", app: "si", jobright: "sd", simplify: "sd", torre: "sd", fuente: `${APP_NAME}: familias de habilidades en src/core/analisis/habilidades.ts.` },
  { capacidad: "Prioridad explicable para elegir a cuáles postular", app: "si", jobright: "sd", simplify: "sd", torre: "sd", fuente: `${APP_NAME}: src/core/seguimiento/prioridad.ts.` },
  { capacidad: "Ofertas y CV en español e inglés", app: "si", jobright: "sd", simplify: "sd", torre: "sd", fuente: `${APP_NAME}: alias ES/EN y detección de idioma.` },
  { capacidad: "Búsqueda en varias plataformas con duplicados fusionados", app: "si", jobright: "sd", simplify: "sd", torre: "sd", fuente: `${APP_NAME}: 12 fuentes en src/server/fuentes (APIs públicas y tableros oficiales de empresas), elegibles hasta 5.` },
  { capacidad: "CV y carta a la medida por vacante, sin inventar experiencia", app: "si", jobright: "sd", simplify: "sd", torre: "sd", fuente: `${APP_NAME}: src/core/documentos (reordena y destaca solo lo que está en el perfil).` },
  { capacidad: "Detector de ofertas riesgosas", app: "si", jobright: "sd", simplify: "sd", torre: "sd", fuente: `${APP_NAME}: src/core/radar + tests.` },
  { capacidad: "Sello humano antes de marcar una postulación", app: "si", jobright: "sd", simplify: "sd", torre: "sd", fuente: `${APP_NAME}: src/core/seguimiento (marcarPostulada).` },
  { capacidad: "Instalable como app", app: "si", jobright: "sd", simplify: "sd", torre: "sd", fuente: `${APP_NAME}: manifest + service worker.` },
  { capacidad: "Funciona sin crear una cuenta", app: "si", jobright: "sd", simplify: "sd", torre: "sd", fuente: `${APP_NAME} usa un perfil local sin registro.` },
  { capacidad: "Persistencia estructurada en tu instalación local", app: "si", jobright: "sd", simplify: "sd", torre: "sd", fuente: `${APP_NAME}: Postgres local vía docker-compose y endpoints internos de Next.` },
];

export const PENDIENTES = [
  "OCR para CV escaneados (hoy se avisa y se pide un PDF con texto seleccionable).",
  "Extensión de navegador para autocompletar formularios como asistencia, nunca envío automático.",
  "Cuentas reales y sincronización entre dispositivos sin perder el enfoque personal del MVP.",
  "Diccionario de habilidades más amplio y calibrado con ofertas reales de LatAm.",
];

