import Link from "next/link";
import { botaoClasses } from "@/components/Botao";
import { EstadoVazio } from "@/components/EstadoVazio";
import { Paginacao } from "@/components/Paginacao";
import { STATUS_COMISSAO_LABEL, rotular } from "@/lib/labels";
import { dataCivilInstitucional } from "@/server/operacao/fuso";
import { EstornarComissao } from "./EstornarComissao";
import type { PainelComissoes as Painel, PeriodoComissao } from "@/server/crm/comissoes-painel";

const PERIODO_ROTULO: Record<PeriodoComissao, string> = {
  mes: "Este mês", mes_anterior: "Mês anterior", trimestre: "Últimos 3 meses", ano: "Este ano",
};
const BASE_ROTULO: Record<string, string> = { TAXA_MATRICULA: "taxa de matrícula" };

/** Valor sempre com o código da moeda ao lado (nunca "R$" fixo) e duas casas, como o fechamento do mês. */
const moeda = (valor: string, codigo: string) =>
  `${codigo} ${new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(valor))}`;

/** "5% da taxa de matrícula" ou "Valor fixo". */
function calculo(l: Painel["linhas"][number]) {
  if (l.percentual === null) return "Valor fixo";
  return `${new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 2 }).format(Number(l.percentual))}% da ${BASE_ROTULO[l.base] ?? "base da política"}`;
}

/** Só PENDENTE/APROVADA estornam; a paga exigiria desconto no fechamento (fora da fase). */
const estornavel = (status: string) => status === "PENDENTE" || status === "APROVADA";

function dia(data: Date, fuso: string) {
  const [a, m, d] = dataCivilInstitucional(data, fuso).split("-");
  return `${d}/${m}/${a}`;
}

export function PainelComissoes({ painel, periodo, pagina, vendedorId, vendedores, veTodos, podeFecharMes, podeEstornar = false, fuso, hrefPagina }: {
  painel: Painel;
  periodo: PeriodoComissao;
  pagina: number;
  vendedorId: string;
  vendedores: { id: string; nome: string }[];
  veTodos: boolean;
  podeFecharMes: boolean;
  podeEstornar?: boolean;
  fuso: string;
  hrefPagina: (pagina: number) => string;
}) {
  const filtrando = !!vendedorId;
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-medium">{veTodos ? "Comissões" : "Minhas comissões"}</h1>
        {podeFecharMes && <Link href="/financeiro/comissoes" className={botaoClasses({ variante: "secundario" })}>Fechar mês</Link>}
      </div>

      <form method="get" action="/comissoes" role="search" aria-label="Filtrar comissões" className="flex flex-wrap items-center gap-2">
        <select name="periodo" defaultValue={periodo} aria-label="Período" className="min-h-11 rounded-md border border-gray-300 px-2 text-sm md:min-h-0 md:py-1.5">
          {(Object.keys(PERIODO_ROTULO) as PeriodoComissao[]).map((p) => <option key={p} value={p}>{PERIODO_ROTULO[p]}</option>)}
        </select>
        {veTodos && (
          <select name="vendedor" defaultValue={vendedorId} aria-label="Vendedor" className="min-h-11 rounded-md border border-gray-300 px-2 text-sm md:min-h-0 md:py-1.5">
            <option value="">Todos os vendedores</option>
            {vendedores.map((v) => <option key={v.id} value={v.id}>{v.nome}</option>)}
          </select>
        )}
        <button type="submit" className={botaoClasses({ variante: "secundario" })}>Filtrar</button>
        {(filtrando || periodo !== "mes") && <Link href="/comissoes" className="text-sm text-brand-700 hover:underline">Limpar filtros</Link>}
      </form>

      {painel.totais.length > 0 && (
        <section aria-label="Totais por situação" className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {painel.totais.map((t, i) => (
            <div key={`${t.moeda}-${i}`} className="rounded-lg border border-border-soft p-3">
              <p className="text-xs text-gray-600">{rotular(STATUS_COMISSAO_LABEL, t.status)}</p>
              <p className="text-lg font-medium">{moeda(t.valor, t.moeda)}</p>
            </div>
          ))}
        </section>
      )}

      {painel.matriculadasSemComissao.length > 0 && (
        <section aria-label="Matrículas sem comissão" className="rounded-lg border border-border-soft p-3 text-sm">
          <h2 className="font-medium">Matriculadas sem comissão</h2>
          <ul className="mt-1 space-y-1">
            {painel.matriculadasSemComissao.map((o) => (
              <li key={o.oportunidadeId}><Link href={`/funil?o=${o.oportunidadeId}`} className="text-brand-700 hover:underline max-sm:inline-flex max-sm:min-h-11 max-sm:items-center">{o.nome}</Link></li>
            ))}
          </ul>
        </section>
      )}

      {veTodos && painel.porVendedor.length > 0 && (
        <section aria-label="Por vendedor" className="space-y-1 text-sm">
          <h2 className="font-medium">Por vendedor</h2>
          <ul className="divide-y divide-border-soft rounded-lg border border-border-soft">
            {painel.porVendedor.map((v) => (
              <li key={`${v.vendedorId}-${v.moeda}`} className="flex flex-wrap justify-between gap-2 p-3">
                <span>{v.nome} · {v.quantidade} {v.quantidade === 1 ? "comissão" : "comissões"}</span>
                <span className="font-medium">{moeda(v.valor, v.moeda)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {veTodos && painel.porPolitica.length > 0 && (
        <section aria-label="Por política" className="space-y-1 text-sm">
          <h2 className="font-medium">Por política</h2>
          <ul className="divide-y divide-border-soft rounded-lg border border-border-soft">
            {painel.porPolitica.map((p) => (
              <li key={`${p.politicaId ?? "sem"}-${p.moeda}`} className="flex flex-wrap justify-between gap-2 p-3">
                <span>{p.rotulo}</span>
                <span className="font-medium">{moeda(p.valor, p.moeda)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {painel.evolucao.length > 0 && (
        <section aria-label="Evolução por mês" className="space-y-1 text-sm">
          <h2 className="font-medium">Evolução por mês</h2>
          <ul className="divide-y divide-border-soft rounded-lg border border-border-soft">
            {painel.evolucao.map((e) => (
              <li key={`${e.mes}-${e.moeda}`} className="flex flex-wrap justify-between gap-2 p-3">
                <span>{e.mes.split("-").reverse().join("/")}</span>
                <span className="font-medium">{moeda(e.valor, e.moeda)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section aria-label="Comissões do período" className="space-y-2">
        <h2 className="font-medium">Comissões do período</h2>
        {painel.linhas.length === 0 ? (
          <EstadoVazio bloco>{filtrando ? "Nenhuma comissão com esses filtros." : "Nenhuma comissão neste período."}</EstadoVazio>
        ) : (
          <>
            <div className="hidden overflow-x-auto rounded-lg border border-border-soft md:block">
              <table className="hidden w-full text-left text-sm md:table">
                <thead className="bg-surface-muted text-xs text-gray-600">
                  <tr>
                    <th scope="col" className="px-4 py-2 font-medium">Aluno</th>
                    <th scope="col" className="px-4 py-2 font-medium">Produto</th>
                    <th scope="col" className="px-4 py-2 font-medium">Beneficiário</th>
                    <th scope="col" className="px-4 py-2 font-medium">Cálculo</th>
                    <th scope="col" className="px-4 py-2 font-medium">Valor</th>
                    <th scope="col" className="px-4 py-2 font-medium">Situação</th>
                    <th scope="col" className="px-4 py-2 font-medium">Competência</th>
                    {podeEstornar && <th scope="col" className="px-4 py-2 font-medium">Ações</th>}
                  </tr>
                </thead>
                <tbody>
                  {painel.linhas.map((l) => (
                    <tr key={l.id} className="border-t border-border-soft">
                      <td className="px-4 py-2">{l.nome}</td>
                      <td className="px-4 py-2">{l.produto}</td>
                      <td className="px-4 py-2">{l.vendedor}</td>
                      <td className="px-4 py-2">{calculo(l)}</td>
                      <td className="px-4 py-2">{moeda(l.valor, l.moeda)}</td>
                      <td className="px-4 py-2">{rotular(STATUS_COMISSAO_LABEL, l.status)}</td>
                      <td className="px-4 py-2">{dia(l.competencia, fuso)}</td>
                      {podeEstornar && <td className="px-4 py-2">{estornavel(l.status) && <EstornarComissao id={l.id} aluno={l.nome} valor={moeda(l.valor, l.moeda)} />}</td>}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <ul className="space-y-2 md:hidden">
              {painel.linhas.map((l) => (
                <li key={l.id} className="space-y-1 rounded-lg border border-border-soft p-3 text-sm">
                  <p className="font-medium">{l.nome}</p>
                  <p className="text-gray-600">{l.produto} · {l.vendedor}</p>
                  <p>{calculo(l)}</p>
                  <p className="flex flex-wrap justify-between gap-2"><span className="font-medium">{moeda(l.valor, l.moeda)}</span><span>{rotular(STATUS_COMISSAO_LABEL, l.status)}</span></p>
                  <p className="text-xs text-gray-600">{dia(l.competencia, fuso)}</p>
                  {podeEstornar && estornavel(l.status) && <EstornarComissao id={l.id} aluno={l.nome} valor={moeda(l.valor, l.moeda)} />}
                </li>
              ))}
            </ul>
          </>
        )}
        <Paginacao pagina={pagina} temProxima={painel.possuiMais} href={hrefPagina} rotulo="Páginas de comissões" />
      </section>
    </div>
  );
}
