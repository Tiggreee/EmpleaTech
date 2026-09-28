import Preparar from "@/features/preparar/Preparar";

export const metadata = { title: "CV y carta a la medida" };

export default async function PrepararPage({ searchParams }: { searchParams: Promise<{ vacante?: string; postulacion?: string }> }) {
  const { vacante, postulacion } = await searchParams;
  return <Preparar vacanteId={typeof vacante === "string" ? vacante : undefined} postulacionId={typeof postulacion === "string" ? postulacion : undefined} />;
}
