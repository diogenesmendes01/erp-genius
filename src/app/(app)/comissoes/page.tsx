import Link from "next/link";
import { redirect } from "next/navigation";
import { Papel, StatusComissao } from "@prisma/client";
import { exigirSessaoPagina } from "@/server/_shared";
import { COMISSOES_POR_PAGINA, listarComissoesPagina } from "@/server/financeiro/consultas";
import { formatarMoeda } from "@/lib/dinheiro";
import { STATUS_COMISSAO_LABEL } from "@/lib/labels";
import { Paginacao } from "@/components/Paginacao";
import { faixaDaPagina, hrefLista, lerOpcao, lerPagina, paginaAlemDoFim, type ParametrosUrl } from "@/lib/pagina-url";
import { botaoClasses } from "@/components/Botao";
import { EstadoVazio } from "@/components/EstadoVazio";

/** Beneficiário histórico tem acesso à comissão sem recuperar a carteira transferida. */
export default async function ComissoesPage({ searchParams }: { searchParams: Promise<ParametrosUrl> }) {
  await exigirSessaoPagina(Papel.VENDEDOR, Papel.GERENTE_COMERCIAL, Papel.FINANCEIRO);
  // Filtro e página na URL (E4): antes vinham todas as comissões do escopo de uma vez.
  const parametros = await searchParams;
  const status = lerOpcao(parametros, "status", Object.values(StatusComissao));
  const pagina = lerPagina(parametros);
  const { itens: comissoes, total } = await listarComissoesPagina({ status, pagina });
  const ultima = paginaAlemDoFim(pagina, COMISSOES_POR_PAGINA, total);
  if (ultima) redirect(hrefLista("/comissoes", { status, pagina: ultima }));
  const { inicio, fim, temProxima } = faixaDaPagina(pagina, COMISSOES_POR_PAGINA, comissoes.length, total);
  return <div className="space-y-4"><h1 className="text-2xl font-medium">Comissões</h1>
    <p className="text-sm text-gray-600">Comissões das negociações autorizadas, preservadas quando muda o responsável pelo atendimento.</p>
    <form method="get" action="/comissoes" aria-label="Filtrar comissões" className="flex flex-wrap items-center gap-2">
      <select name="status" defaultValue={status ?? ""} aria-label="Filtrar por situação" className="rounded-md border border-gray-300 px-2 py-1.5 text-sm outline-none focus:border-brand-500">
        <option value="">Todas as situações</option>
        {Object.values(StatusComissao).map((s) => <option key={s} value={s}>{STATUS_COMISSAO_LABEL[s]}</option>)}
      </select>
      <button type="submit" className={botaoClasses({ variante: "secundario" })}>Filtrar</button>
      {status && <Link href="/comissoes" className="text-sm text-brand-700 hover:underline">Limpar filtro</Link>}
    </form>
    {total > 0 && <p className="text-xs text-gray-500">{inicio}–{fim} de {total} {total === 1 ? "comissão" : "comissões"}</p>}
    <div className="overflow-x-auto rounded border"><table className="w-full text-left text-sm">
      <thead><tr className="bg-gray-50"><th className="p-3">Beneficiário</th><th className="p-3">Cálculo</th><th className="p-3">Valor</th><th className="p-3">Situação</th></tr></thead>
      <tbody>{comissoes.map((c) => <tr key={c.id} className="border-t"><td className="p-3">{c.vendedor}</td><td className="p-3">{c.tipo === "VALOR_FIXO" ? "Valor fixo" : `${c.percentual}% da taxa`}</td><td className="p-3">{formatarMoeda(c.valor, c.moeda)}</td><td className="p-3">{STATUS_COMISSAO_LABEL[c.status]}</td></tr>)}</tbody>
    </table></div>
    {!comissoes.length && <EstadoVazio bloco>{status ? <>Nenhuma comissão nesta situação. <Link href="/comissoes" className="text-brand-700 hover:underline">Ver todas</Link></> : "Nenhuma comissão no seu escopo."}</EstadoVazio>}
    <Paginacao pagina={pagina} temProxima={temProxima} href={(p) => hrefLista("/comissoes", { status, pagina: p })} rotulo="Páginas de comissões" />
  </div>;
}
