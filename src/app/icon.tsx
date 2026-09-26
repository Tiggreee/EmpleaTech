import { ImageResponse } from "next/og";
import { APP_NAME } from "@/config/app";

export function generateImageMetadata() {
  return [
    { id: "32", size: { width: 32, height: 32 }, contentType: "image/png", alt: APP_NAME },
    { id: "192", size: { width: 192, height: 192 }, contentType: "image/png", alt: APP_NAME },
    { id: "512", size: { width: 512, height: 512 }, contentType: "image/png", alt: APP_NAME },
  ];
}

export default async function Icon({ id }: { id: Promise<string | number> }) {
  const tam = Number(await id);
  const trazo = Math.max(2, Math.round(tam * 0.06));
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "#05070f" }}>
        <svg width={tam * 0.62} height={tam * 0.62} viewBox="0 0 32 32">
          <defs>
            <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#22d3ee" />
              <stop offset="1" stopColor="#8b5cf6" />
            </linearGradient>
          </defs>
          <path d="M16 3.5 L28.5 28 H3.5 Z" fill="none" stroke="url(#g)" strokeWidth={(trazo / tam) * 32 * 1.6} strokeLinejoin="round" />
          <circle cx="16" cy="3.6" r="2.7" fill="url(#g)" />
        </svg>
      </div>
    ),
    { width: tam, height: tam },
  );
}

