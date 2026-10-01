"use client";

import { useMemo } from "react";
import { encode } from "uqr";

/** QR dibujado aquí mismo: el secreto no sale a ningún servicio para generar la imagen. */
export default function Qr({ texto, tamano = 208 }: { texto: string; tamano?: number }) {
  const { d, lado } = useMemo(() => {
    const qr = encode(texto, { ecc: "M", border: 2 });
    let ruta = "";
    qr.data.forEach((fila, y) => fila.forEach((negro, x) => negro && (ruta += `M${x} ${y}h1v1h-1z`)));
    return { d: ruta, lado: qr.size };
  }, [texto]);
  return (
    <svg
      role="img"
      aria-label="Código QR para tu app de autenticación"
      viewBox={`0 0 ${lado} ${lado}`}
      width={tamano}
      height={tamano}
      shapeRendering="crispEdges"
      className="rounded-lg bg-white"
    >
      <path d={d} fill="#000" />
    </svg>
  );
}
