import Link from "next/link";

/** Indicador com a variação em relação ao período anterior. Sem base de comparação, o traço "—" (nunca Infinity/NaN). */
export function Kpi({ rotulo, valor, variacao, anterior, complemento, href }: {
  rotulo: string;
  valor: string;
  variacao: string;
  /** Valor do período anterior, já formatado. */
  anterior?: string;
  complemento?: string;
  /** Abre o painel de oportunidades por trás do número. */
  href?: string;
}) {
  return (
    <div className="rounded-lg border border-border-soft p-3">
      <p className="text-xs text-gray-600">{rotulo}</p>
      <p className="text-lg font-medium">
        {href ? <Link href={href} className="hover:underline max-sm:inline-flex max-sm:min-h-11 max-sm:items-center">{valor}</Link> : valor}
      </p>
      <p className="text-xs text-gray-600">
        <span data-variacao="">{variacao}</span>
        {anterior !== undefined && <span> · antes {anterior}</span>}
      </p>
      {complemento && <p className="mt-1 text-xs text-gray-600">{complemento}</p>}
    </div>
  );
}
