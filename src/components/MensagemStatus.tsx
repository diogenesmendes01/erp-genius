import { Aviso, type TomAviso } from "./Aviso";

export function MensagemStatus({ texto, className, progresso, tom }: {
  texto: string | null | undefined;
  className?: string;
  progresso?: string | null;
  tom?: TomAviso;
}) {
  return (
    <>
      <p role="status" className="sr-only">{progresso || texto}</p>
      {texto && (tom
        ? <Aviso tom={tom} papel="nenhum" aria-hidden className={className}>{texto}</Aviso>
        : <p aria-hidden="true" className={className}>{texto}</p>)}
      {progresso && <p aria-hidden="true">{progresso}</p>}
    </>
  );
}
