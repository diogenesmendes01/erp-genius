// Região polite só anuncia mudança se já existia no DOM antes do texto aparecer — um <p role="status">
// montado junto com a mensagem pode passar em silêncio. Por isso: região sr-only sempre montada (absoluta,
// não ocupa espaço nem vira item de flex/gap) + mensagem visível com aria-hidden, para não ser lida duas vezes.
export function MensagemStatus({ texto, className }: { texto: string | null | undefined; className: string }) {
  return (
    <>
      <p role="status" className="sr-only">{texto}</p>
      {texto && <p aria-hidden="true" className={className}>{texto}</p>}
    </>
  );
}
