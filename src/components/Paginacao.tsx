import Link from "next/link";

type AoClicar = (href: string) => (e: React.MouseEvent<HTMLAnchorElement>) => void;

/**
 * Paginação nos dois sentidos (E4): "← Anterior · Página N · Próxima →", com links reais (abrem em
 * nova aba, podem ser copiados). `aoClicar` opcional faz o clique simples navegar numa transição.
 * Não aparece quando há uma página só.
 */
export function Paginacao({ pagina, temProxima, href, aoClicar, rotulo }: {
  pagina: number;
  temProxima: boolean;
  /** Link da mesma lista, com os filtros atuais, na página indicada. */
  href: (pagina: number) => string;
  aoClicar?: AoClicar;
  /** Nome da navegação para leitor de tela ("Páginas de empresas"). */
  rotulo: string;
}) {
  if (pagina <= 1 && !temProxima) return null;
  const link = (p: number, texto: string) => (
    <Link href={href(p)} onClick={aoClicar?.(href(p))} className="text-brand-700 hover:underline">{texto}</Link>
  );
  return (
    <nav aria-label={rotulo} className="mt-3 flex items-center gap-4 text-sm">
      {pagina > 1 && link(pagina - 1, "← Anterior")}
      <span className="text-gray-500" aria-current="page">Página {pagina}</span>
      {temProxima && link(pagina + 1, "Próxima →")}
    </nav>
  );
}
