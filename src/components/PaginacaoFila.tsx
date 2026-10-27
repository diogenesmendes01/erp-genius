import Link from "next/link";

export type CursorDoLink = { antes: string } | { depois: string };

export function PaginacaoFila({ anterior, proxima, href, rotulo }: {
  anterior: string | null;
  proxima: string | null;
  href: (cursor: CursorDoLink) => string;
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
