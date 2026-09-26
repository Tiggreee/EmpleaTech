import { ImageResponse } from "next/og";
import { APP_NAME } from "@/config/app";

export const alt = `${APP_NAME} — asistente personal de búsqueda de empleo`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraph() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "center", padding: 80, background: "linear-gradient(135deg, #05070f 40%, #1a1140 100%)", color: "#eaf0ff" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <svg width="72" height="72" viewBox="0 0 32 32">
            <defs>
              <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0" stopColor="#22d3ee" />
                <stop offset="1" stopColor="#8b5cf6" />
              </linearGradient>
            </defs>
            <path d="M16 3.5 L28.5 28 H3.5 Z" fill="none" stroke="url(#g)" strokeWidth="2.6" strokeLinejoin="round" />
            <circle cx="16" cy="3.6" r="2.7" fill="url(#g)" />
          </svg>
          <div style={{ fontSize: 56, fontWeight: 700 }}>{APP_NAME}</div>
        </div>
        <div style={{ marginTop: 40, fontSize: 76, fontWeight: 700, lineHeight: 1.05, display: "flex", flexWrap: "wrap" }}>
          <span>Tu búsqueda,</span>
          <span style={{ color: "#22d3ee", marginLeft: 18 }}>con datos.</span>
        </div>
        <div style={{ marginTop: 32, fontSize: 32, color: "#9aa7c7", maxWidth: 920 }}>
          Analiza CVs y ofertas, detecta riesgos y guarda tu historial en Postgres local para probar un flujo full-stack real.
        </div>
      </div>
    ),
    size,
  );
}

