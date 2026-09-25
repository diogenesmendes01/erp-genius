import Link from "next/link";
import { redirect } from "next/navigation";
import { StatusComissao } from "@prisma/client";
import { COMISSOES_POR_PAGINA, carregarConfigFinanceiro, listarComissoesPagina, totaisComissoesAPagar } from "@/server/financeiro/consultas";
import { ComissoesAba } from "../../FinanceiroPainel";
import { AcessoNegado } from "@/components/AcessoNegado";
import { Paginacao } from "@/components/Paginacao";
import { botaoClasses } from "@/components/Botao";
import { STATUS_COMISSAO_LABEL } from "@/lib/labels";
import { faixaDaPagina, hrefLista, lerOpcao, lerPagina, paginaAlemDoFim, type ParametrosUrl } from "@/lib/pagina-url";
import { contextoDaAba } from "../../contexto";

const ROTA = "/financeiro/comissoes";

// Aba "comissoes" do /financeiro (E8: uma rota por aba). Guard da própria aba ANTES das consultas — o
// layout só decide a barra; uma rota pedida direto por quem não enxerga a aba não consulta nada.
// E4: antes trazia todas as comissões do escopo de uma vez; agora filtro por situação e página na URL
// (50 por página, como /comissoes). O total "a pagar" vem agregado do servidor, não da página exibida.
export default async function ComissoesFinanceiroPage({ searchParams }: { searchParams: Promise<ParametrosUrl> }) {
  const ctx = await contextoDaAba("comissoes");
  if (!ctx) return <AcessoNegado recurso="esta seção do financeiro" />;
  const parametros = await searchParams;
  const status = lerOpcao(parametros, "status", Object.values(StatusComissao));
  const pagina = lerPagina(parametros);
  const [{ itens: comissoes, total }, aPagar, config] = await Promise.all([
    listarComissoesPagina({ status, pagina }),
    totaisComissoesAPagar(),
    carregarConfigFinanceiro(),
  ]);
  const ultima = paginaAlemDoFim(pagina, COMISSOES_POR_PAGINA, total);
  if (ultima) redirect(hrefLista(ROTA, { status, pagina: ultima }));
  const { inicio, fim, temProxima } = faixaDaPagina(pagina, COMISSOES_POR_PAGINA, comissoes.length, total);
  return (
    <div className="space-y-3">
      <form method="get" action={ROTA} aria-label="Filtrar comissões" className="flex flex-wrap items-center gap-2">
        <select name="status" defaultValue={status ?? ""} aria-label="Filtrar por situação" className="rounded-md border border-gray-300 px-2 py-1.5 text-sm outline-none focus:border-brand-500">
          <option value="">Todas as situações</option>
          {Object.values(StatusComissao).map((s) => <option key={s} value={s}>{STATUS_COMISSAO_LABEL[s]}</option>)}
        </select>
        <button type="submit" className={botaoClasses({ variante: "secundario" })}>Filtrar</button>
        {status && <Link href={ROTA} className="text-sm text-brand-700 hover:underline">Limpar filtro</Link>}
      </form>
      {total > 0 && <p className="text-xs text-gray-500">{inicio}–{fim} de {total} {total === 1 ? "comissão" : "comissões"}</p>}
      <ComissoesAba comissoes={comissoes} aPagar={aPagar} podePagar={ctx.permissoes.podeOperarCobranca} fechamentoAutomatico={config.fechamentoComissaoAutomatico} />
      <Paginacao pagina={pagina} temProxima={temProxima} href={(p) => hrefLista(ROTA, { status, pagina: p })} rotulo="Páginas de comissões" />
    </div>
  );
}
