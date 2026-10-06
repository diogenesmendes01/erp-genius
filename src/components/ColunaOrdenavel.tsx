import Link from "next/link";
import { IconArrowDown, IconArrowUp, IconArrowsSort } from "@tabler/icons-react";
import { hrefOrdenacao, proximaDirecao, type Direcao, type Ordenacao } from "@/lib/ordenacao";

type AoClicar = (href: string) => (e: React.MouseEvent<HTMLAnchorElement>) => void;

const ARIA_SORT: Record<Direcao, "ascending" | "descending"> = { asc: "ascending", desc: "descending" };
const ACAO: Record<Direcao, string> = { asc: "ordenar em ordem crescente", desc: "ordenar em ordem decrescente" };

/**
 * Cabeçalho de coluna ordenável (E1, docs/42-auditoria-frontend-ux.md §5.6 A9). O `<th>` diz a ordem
 * atual em `aria-sort`; o rótulo é um link real (funciona sem JavaScript, abre em nova aba, pode ser
 * copiado) para a mesma lista com a nova ordem, os mesmos filtros e de volta à página 1. A ordenação é
 * feita no servidor (a lista é paginada). A seta é só visual (`aria-hidden`); o texto oculto diz o que
 * o clique faz. É o ÚNICO lugar do app que escreve `aria-sort` (trava em src/app/colunas-ordenaveis.test.ts).
 */
export function ColunaOrdenavel({
  campo,
  rotulo,
  ordenacao,
  rota,
  parametros = {},
  direcaoInicial = "asc",
  aoClicar,
  className = "px-4 py-2 font-medium",
}: {
  /** Nome da coluna na lista fechada da tela (valor de `ordem` na URL). */
  campo: string;
  rotulo: string;
  /** Ordem atual da lista (null: ordem padrão da tela, sem coluna correspondente). */
  ordenacao: Ordenacao | null;
  /** Rota da lista ("/alunos"). */
  rota: string;
  /** Busca e filtros atuais — preservados no link; `pagina`, `ordem` e `dir` são substituídos. */
  parametros?: Record<string, string>;
  /** Direção do primeiro clique nesta coluna (valores e contagens costumam começar do maior). */
  direcaoInicial?: Direcao;
  /** Clique simples dentro de uma transição (listas com useFiltrosUrl). */
  aoClicar?: AoClicar;
  className?: string;
}) {
  const atual = ordenacao?.campo === campo ? ordenacao.dir : null;
  const proxima = proximaDirecao(ordenacao, campo, direcaoInicial);
  const href = hrefOrdenacao(rota, parametros, { campo, dir: proxima });
  const Seta = atual === "asc" ? IconArrowUp : atual === "desc" ? IconArrowDown : IconArrowsSort;
  return (
    // aria-sort só na coluna ordenada (WAI-ARIA 1.2: "only one header at a time"; exemplo do APG); nas
    // demais, o texto oculto do link já diz que a coluna ordena e em que direção.
    <th scope="col" aria-sort={atual ? ARIA_SORT[atual] : undefined} className={className}>
      <Link href={href} onClick={aoClicar?.(href)} className="inline-flex items-center gap-1 hover:text-gray-700 hover:underline">
        {rotulo}
        <span className="sr-only">{`: ${ACAO[proxima]}`}</span>
        <Seta aria-hidden="true" data-direcao={atual ?? "nenhuma"} className={"h-3.5 w-3.5 shrink-0 " + (atual ? "text-gray-700" : "text-gray-400")} />
      </Link>
    </th>
  );
}
