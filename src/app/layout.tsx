import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Nav from "@/components/Nav";
import PwaBarra from "@/components/PwaBarra";
import { APP_NAME } from "@/config/app";
import { SITIO } from "@/content/sitio";
import { DatosProvider } from "@/storage/hooks";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

const DESCRIPCION = `${APP_NAME} analiza tu CV contra ofertas reales, detecta riesgos y guarda CVs, análisis y postulaciones en Postgres local para que puedas probar tu propio flujo end to end.`;

export const metadata: Metadata = {
  metadataBase: new URL(SITIO),
  title: { default: `${APP_NAME} — Asistente personal de búsqueda de empleo`, template: `%s — ${APP_NAME}` },
  description: DESCRIPCION,
  applicationName: APP_NAME,
  openGraph: { title: `${APP_NAME} — Asistente personal de búsqueda de empleo`, description: DESCRIPCION, siteName: APP_NAME, locale: "es_MX", type: "website" },
  twitter: { card: "summary_large_image", title: `${APP_NAME} — Asistente personal de búsqueda de empleo`, description: DESCRIPCION },
};

export const viewport: Viewport = { themeColor: "#05070f", colorScheme: "dark" };

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">
        <DatosProvider>
          <PwaBarra />
          <Nav />
          <div className="flex-1">{children}</div>
          <footer className="border-t border-white/10 px-5 py-6 text-center text-xs text-tenue">
            <p>{APP_NAME} no envía postulaciones por ti. Tú decides qué guardar, qué descartar y qué enviar.</p>
            <p className="mx-auto mt-2 max-w-3xl">Tus CVs, ofertas guardadas y postulaciones viven en tu base local de Postgres para que puedas revisarlos, exportarlos y analizarlos después con SQL.</p>
          </footer>
        </DatosProvider>
      </body>
    </html>
  );
}

