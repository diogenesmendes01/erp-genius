import Link from "next/link";
import { IconArrowDown, IconArrowUp, IconArrowsSort } from "@tabler/icons-react";
import { hrefOrdenacao, proximaDirecao, type Direcao, type Ordenacao } from "@/lib/ordenacao";

type AoClicar = (href: string) => (e: React.MouseEvent<HTMLAnchorElement>) => void;

const ARIA_SORT: Record<Direcao, "ascending" | "descending"> = { asc: "ascending", desc: "descending" };
const ACAO: Record<Direcao, string> = { asc: "ordenar em ordem crescente", desc: "ordenar em ordem decrescente" };

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
  campo: string;
  rotulo: string;
  ordenacao: Ordenacao | null;
  rota: string;
  parametros?: Record<string, string>;
  direcaoInicial?: Direcao;
  aoClicar?: AoClicar;
  className?: string;
}) {
  const atual = ordenacao?.campo === campo ? ordenacao.dir : null;
  const proxima = proximaDirecao(ordenacao, campo, direcaoInicial);
  const href = hrefOrdenacao(rota, parametros, { campo, dir: proxima });
  const Seta = atual === "asc" ? IconArrowUp : atual === "desc" ? IconArrowDown : IconArrowsSort;
  return (
    <th scope="col" aria-sort={atual ? ARIA_SORT[atual] : undefined} className={className}>
      <Link href={href} onClick={aoClicar?.(href)} className="relative inline-flex items-center gap-1 hover:text-gray-700 hover:underline">
        {rotulo}
        <span className="sr-only">{`: ${ACAO[proxima]}`}</span>
        <Seta aria-hidden="true" data-direcao={atual ?? "nenhuma"} className={"h-3.5 w-3.5 shrink-0 " + (atual ? "text-gray-700" : "text-gray-400")} />
      </Link>
    </th>
  );
}
