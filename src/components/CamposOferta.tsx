interface Props {
  empresa: string;
  puesto: string;
  url: string;
  onEmpresa: (valor: string) => void;
  onPuesto: (valor: string) => void;
  onUrl: (valor: string) => void;
}

/** Empresa, puesto y URL de una oferta: los mismos campos al guardar un análisis y al agregar una postulación a mano. */
export default function CamposOferta({ empresa, puesto, url, onEmpresa, onPuesto, onUrl }: Props) {
  return (
    <>
      <input className="campo" placeholder="Empresa" aria-label="Empresa" value={empresa} onChange={(e) => onEmpresa(e.target.value)} maxLength={200} />
      <input className="campo" placeholder="Puesto" aria-label="Puesto" value={puesto} onChange={(e) => onPuesto(e.target.value)} maxLength={200} />
      <input className="campo" placeholder="URL de la oferta (opcional)" aria-label="URL de la oferta" value={url} onChange={(e) => onUrl(e.target.value)} />
    </>
  );
}
