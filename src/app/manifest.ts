import type { MetadataRoute } from "next";
import { APP_NAME, APP_SHORT_NAME } from "@/config/app";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: `${APP_NAME} — asistente personal de búsqueda de empleo`,
    short_name: APP_SHORT_NAME,
    description: "Analiza tu CV, detecta riesgos y da seguimiento a tus postulaciones con Postgres local.",
    lang: "es",
    start_url: "/panel",
    scope: "/",
    display: "standalone",
    background_color: "#f3f3ef",
    theme_color: "#f3f3ef",
    categories: ["productivity", "business"],
    icons: [
      { src: "/icon/192", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon/512", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon/512", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Analizar una oferta", url: "/analizar" },
      { name: "Mis postulaciones", url: "/postulaciones" },
    ],
  };
}

