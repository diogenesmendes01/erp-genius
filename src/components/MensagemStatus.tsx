// Região polite só anuncia mudança se já existia no DOM antes do texto aparecer — um <p role="status">
// montado junto com a mensagem pode passar em silêncio. Por isso: região sr-only sempre montada (absoluta,
// não ocupa espaço nem vira item de flex/gap) + mensagem visível com aria-hidden, para não ser lida duas vezes.
// `progresso` ("Processando…") divide a mesma região com o resultado — uma só região por bloco, em vez de
// duas vazias lado a lado; enquanto houver progresso, é ele que a região anuncia.
import { Aviso, type TomAviso } from "./Aviso";

export function MensagemStatus({ texto, className, progresso, tom }: {
  texto: string | null | undefined;
  className?: string;
  progresso?: string | null;
  /** Com tom, a mensagem visível é um <Aviso> (a região sr-only continua sendo a que anuncia). */
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
