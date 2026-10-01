import { ImageResponse } from "next/og";
import { APP_NAME } from "@/config/app";

export const alt = `${APP_NAME} — asistente personal de búsqueda de empleo`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraph() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "center", padding: 80, background: "#f3f3ef", color: "#0e0e0e" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 20, borderBottom: "4px solid #0e0e0e", paddingBottom: 24 }}>
          <svg width="64" height="64" viewBox="0 0 32 32">
            <path d="M16 3.5 L28.5 28 H3.5 Z" fill="none" stroke="#ff4f1a" strokeWidth="3" strokeLinejoin="miter" />
            <circle cx="16" cy="3.6" r="2.7" fill="#ff4f1a" />
          </svg>
          <div style={{ fontSize: 52, fontWeight: 900, letterSpacing: -2 }}>{APP_NAME.toUpperCase()}</div>
        </div>
        <div style={{ marginTop: 44, fontSize: 104, fontWeight: 900, lineHeight: 0.92, letterSpacing: -5, display: "flex", flexWrap: "wrap" }}>
          <span>Tu búsqueda,</span>
          <span style={{ color: "#b43a0b", marginLeft: 24 }}>con datos.</span>
        </div>
        <div style={{ marginTop: 36, fontSize: 32, color: "#55554f", maxWidth: 960 }}>
          Vacantes ordenadas contra tu CV, CV y carta a la medida, y seguimiento de cada postulación.
        </div>
      </div>
    ),
    size,
  );
}

