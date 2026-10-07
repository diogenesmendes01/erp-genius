import Link from "next/link";
import { redirect } from "next/navigation";
import { Papel, StatusComissao } from "@prisma/client";
import { exigirSessaoPagina } from "@/server/_shared";
import { COMISSOES_POR_PAGINA, listarComissoesPagina } from "@/server/financeiro/consultas";
import { lerOrdemComissoes, parametrosOrdemComissoes } from "@/server/financeiro/ordem-comissoes";
import { formatarMoeda } from "@/lib/dinheiro";
import { STATUS_COMISSAO_LABEL } from "@/lib/labels";
import { Paginacao } from "@/components/Paginacao";
import { ColunaOrdenavel } from "@/components/ColunaOrdenavel";
import { faixaDaPagina, hrefLista, lerOpcao, lerPagina, lerTexto, paginaAlemDoFim, type ParametrosUrl } from "@/lib/pagina-url";
import { botaoClasses } from "@/components/Botao";
import { EstadoVazio } from "@/components/EstadoVazio";

/** Beneficiário histórico tem acesso à comissão sem recuperar a carteira transferida. */
export default async function ComissoesPage({ searchParams }: { searchParams: Promise<ParametrosUrl> }) {
  await exigirSessaoPagina(Papel.VENDEDOR, Papel.GERENTE_COMERCIAL, Papel.FINANCEIRO);
  // Busca, filtro e página na URL (E4): antes vinham todas as comissões do escopo de uma vez, sem busca.
  // Ordem pelo cabeçalho (E1), feita no servidor; buscar, filtrar, limpar e paginar mantêm a ordem escolhida.
  const parametros = await searchParams;
  const busca = lerTexto(parametros, "busca");
  const status = lerOpcao(parametros, "status", Object.values(StatusComissao));
  const pagina = lerPagina(parametros);
  const ordem = lerOrdemComissoes(parametros);
  const naUrl = parametrosOrdemComissoes(ordem);
  const { itens: comissoes, total } = await listarComissoesPagina({ status, busca, pagina, ordem });
  const ultima = paginaAlemDoFim(pagina, COMISSOES_POR_PAGINA, total);
  if (ultima) redirect(hrefLista("/comissoes", { busca, status, ...naUrl, pagina: ultima }));
  const { inicio, fim, temProxima } = faixaDaPagina(pagina, COMISSOES_POR_PAGINA, comissoes.length, total);
  const todas = hrefLista("/comissoes", naUrl);
  const filtros: Record<string, string> = { ...(busca ? { busca } : {}), ...(status ? { status } : {}) };
  const filtrando = !!(busca || status);
  const coluna = { ordenacao: ordem, rota: "/comissoes", parametros: filtros, className: "p-3" };
  return <div className="space-y-4"><h1 className="text-2xl font-medium">Comissões</h1>
    <p className="text-sm text-gray-600">Comissões das negociações autorizadas, preservadas quando muda o responsável pelo atendimento.</p>
    {/* Formulário GET (funciona sem JavaScript): sem `pagina`, buscar ou filtrar volta à página 1; a ordem vai nos campos ocultos. */}
    <form method="get" action="/comissoes" role="search" aria-label="Buscar e filtrar comissões" className="flex flex-wrap items-center gap-2">
      <input name="busca" defaultValue={busca} maxLength={100} aria-label="Buscar comissão por beneficiário" placeholder="Buscar por beneficiário…" className="w-64 max-w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm outline-none focus:border-brand-500" />
      <select name="status" defaultValue={status ?? ""} aria-label="Filtrar por situação" className="rounded-md border border-gray-300 px-2 py-1.5 text-sm outline-none focus:border-brand-500">
        <option value="">Todas as situações</option>
        {Object.values(StatusComissao).map((s) => <option key={s} value={s}>{STATUS_COMISSAO_LABEL[s]}</option>)}
      </select>
      {naUrl.ordem && naUrl.dir && <><input type="hidden" name="ordem" value={naUrl.ordem} /><input type="hidden" name="dir" value={naUrl.dir} /></>}
      <button type="submit" className={botaoClasses({ variante: "secundario" })}>Filtrar</button>
      {filtrando && <Link href={todas} className="text-sm text-brand-700 hover:underline">Limpar filtros</Link>}
    </form>
    {total > 0 && <p className="text-xs text-gray-500">{inicio}–{fim} de {total} {total === 1 ? "comissão" : "comissões"}</p>}
    <div className="overflow-x-auto rounded border"><table className="w-full text-left text-sm">
      <thead><tr className="bg-gray-50">
        <ColunaOrdenavel campo="vendedor" rotulo="Beneficiário" {...coluna} />
        <th className="p-3">Cálculo</th>
        <ColunaOrdenavel campo="valor" rotulo="Valor" direcaoInicial="desc" {...coluna} />
        <ColunaOrdenavel campo="status" rotulo="Situação" {...coluna} />
      </tr></thead>
      <tbody>{comissoes.map((c) => <tr key={c.id} className="border-t"><td className="p-3">{c.vendedor}</td><td className="p-3">{c.tipo === "VALOR_FIXO" ? "Valor fixo" : `${c.percentual}% da taxa`}</td><td className="p-3">{formatarMoeda(c.valor, c.moeda)}</td><td className="p-3">{STATUS_COMISSAO_LABEL[c.status]}</td></tr>)}</tbody>
    </table></div>
    {!comissoes.length && <EstadoVazio bloco>{filtrando ? <>{busca ? "Nenhuma comissão com esses filtros." : "Nenhuma comissão nesta situação."} <Link href={todas} className="text-brand-700 hover:underline">Ver todas</Link></> : "Nenhuma comissão no seu escopo."}</EstadoVazio>}
    <Paginacao pagina={pagina} temProxima={temProxima} href={(p) => hrefLista("/comissoes", { busca, status, ...naUrl, pagina: p })} rotulo="Páginas de comissões" />
  </div>;
}
