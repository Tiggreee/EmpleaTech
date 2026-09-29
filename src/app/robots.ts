import type { MetadataRoute } from "next";
import { SITIO } from "@/content/sitio";

export default function robots(): MetadataRoute.Robots {
  return {
    // En internet la app es privada (con contraseña): nada que indexar.
    rules: process.env.EMPLEATECH_AUTH === "1" ? { userAgent: "*", disallow: "/" } : { userAgent: "*", allow: "/", disallow: ["/panel", "/analizar", "/cv", "/postulaciones"] },
    sitemap: `${SITIO}/sitemap.xml`,
  };
}
