import Link from "next/link";

/** Cursor de um link da fila: o primeiro item visto (`antes`) ou o último (`depois`). */
export type CursorDoLink = { antes: string } | { depois: string };

/**
 * Navegação das filas de trabalho por cursor nos dois sentidos (E4, decisão de 10/10/2026):
 * "← Anterior · Próxima →", com links reais. Sem número de página: numa fila, quem resolve um item
 * desloca os seguintes, e o número da página deixaria de apontar para o mesmo lugar. O cursor é o id
 * do primeiro item da página (Anterior) ou do último (Próxima). Não aparece quando não há para onde ir.
 * As listas e os históricos usam <Paginacao> (página numerada).
 */
export function PaginacaoFila({ anterior, proxima, href, rotulo }: {
  /** Id do primeiro item da página, quando há itens antes dele (senão null). */
  anterior: string | null;
  /** Id do último item da página, quando há itens depois dele (senão null). */
  proxima: string | null;
  /** Link da mesma fila, com os filtros atuais, no cursor indicado. */
  href: (cursor: CursorDoLink) => string;
  /** Nome da navegação para leitor de tela ("Navegação da fila de desistências"). */
  rotulo: string;
}) {
  if (!anterior && !proxima) return null;
  return (
    <nav aria-label={rotulo} className="mt-3 flex items-center gap-4 text-sm">
      {anterior ? <Link href={href({ antes: anterior })} className="text-brand-700 hover:underline">← Anterior</Link> : null}
      {proxima ? <Link href={href({ depois: proxima })} className="text-brand-700 hover:underline">Próxima →</Link> : null}
    </nav>
  );
}
