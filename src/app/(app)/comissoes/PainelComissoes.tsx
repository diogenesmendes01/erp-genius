import type { ReactNode } from "react";
import Link from "next/link";
import type { StatusComissao } from "@prisma/client";
import { IconCalculator } from "@tabler/icons-react";
import { Avatar } from "@/components/Avatar";
import { BadgeEstado, type TomEstado } from "@/components/BadgeEstado";
import { botaoClasses } from "@/components/Botao";
import { CONTROLE_CAMPO } from "@/components/Campo";
import { EstadoVazio } from "@/components/EstadoVazio";
import { LinhaCampo } from "@/components/LinhaCampo";
import { Paginacao } from "@/components/Paginacao";
import { STATUS_COMISSAO_LABEL, rotular } from "@/lib/labels";
import { dataCivilInstitucional } from "@/server/operacao/fuso";
import { EstornarComissao } from "./EstornarComissao";
import type { PainelComissoes as Painel, PeriodoComissao } from "@/server/crm/comissoes-painel";

const TOM_STATUS: Record<StatusComissao, TomEstado> = {
  PENDENTE: "aviso",
  APROVADA: "aprovacao",
  PAGA: "sucesso",
  ESTORNADA: "perigo",
};

const PERIODO_ROTULO: Record<PeriodoComissao, string> = {
  mes: "Este mês", mes_anterior: "Mês anterior", trimestre: "Últimos 3 meses", ano: "Este ano",
};
const BASE_ROTULO: Record<string, string> = { TAXA_MATRICULA: "taxa de matrícula" };

const moeda = (valor: string, codigo: string) =>
  `${codigo} ${new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(valor))}`;

function calculo(l: Painel["linhas"][number]) {
  if (l.percentual === null) return "Valor fixo";
  return `${new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 2 }).format(Number(l.percentual))}% da ${BASE_ROTULO[l.base] ?? "base da política"}`;
}

const estornavel = (status: string) => status === "PENDENTE" || status === "APROVADA";

function hrefDoAluno(l: { matriculaId?: string; oportunidadeId?: string | null }, podeAbrirPreparacao: boolean) {
  if (l.matriculaId) return podeAbrirPreparacao ? `/matriculas/${encodeURIComponent(l.matriculaId)}/preparacao` : null;
  if (l.oportunidadeId) return `/funil?o=${encodeURIComponent(l.oportunidadeId)}`;
  return null;
}

function NomeDoAluno({ l, podeAbrirPreparacao }: { l: Painel["linhas"][number]; podeAbrirPreparacao: boolean }) {
  const href = hrefDoAluno(l, podeAbrirPreparacao);
  if (!href) return l.nome;
  return <Link href={href} className="font-medium text-brand-700 hover:underline">{l.nome}</Link>;
}

function ComAvatar({ nome, children }: { nome: string; children: ReactNode }) {
  return <span className="inline-flex items-center gap-2"><Avatar nome={nome} tamanho={32} />{children}</span>;
}

function SeloStatus({ status }: { status: StatusComissao }) {
  return <BadgeEstado tom={TOM_STATUS[status]} ponto>{rotular(STATUS_COMISSAO_LABEL, status)}</BadgeEstado>;
}

function diaCivil(data: string | null) {
  if (!data) return "—";
  const [a, m, d] = data.split("-");
  return `${d}/${m}/${a}`;
}

function dia(data: Date, fuso: string) {
  const [a, m, d] = dataCivilInstitucional(data, fuso).split("-");
  return `${d}/${m}/${a}`;
}

export function PainelComissoes({ painel, periodo, pagina, vendedorId, vendedores, veTodos, podeFecharMes, podeEstornar = false, podeAbrirPreparacao = true, fuso, hrefPagina }: {
  painel: Painel;
  periodo: PeriodoComissao;
  pagina: number;
  vendedorId: string;
  vendedores: { id: string; nome: string }[];
  veTodos: boolean;
  podeFecharMes: boolean;
  podeEstornar?: boolean;
  podeAbrirPreparacao?: boolean;
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
        <div className="w-full sm:w-48">
          <select name="periodo" defaultValue={periodo} aria-label="Período" className={CONTROLE_CAMPO}>
            {(Object.keys(PERIODO_ROTULO) as PeriodoComissao[]).map((p) => <option key={p} value={p}>{PERIODO_ROTULO[p]}</option>)}
          </select>
        </div>
        {veTodos && (
          <div className="w-full sm:w-56">
            <select name="vendedor" defaultValue={vendedorId} aria-label="Vendedor" className={CONTROLE_CAMPO}>
              <option value="">Todos os vendedores</option>
              {vendedores.map((v) => <option key={v.id} value={v.id}>{v.nome}</option>)}
            </select>
          </div>
        )}
        <button type="submit" className={botaoClasses({ variante: "secundario" })}>Filtrar</button>
        {(filtrando || periodo !== "mes") && <Link href="/comissoes" className="text-sm text-brand-700 hover:underline">Limpar filtros</Link>}
      </form>

      {painel.totais.length > 0 && (
        <section aria-label="Totais por situação" className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {painel.totais.map((t, i) => (
            <div key={`${t.moeda}-${i}`} className="rounded-lg border border-border-soft p-3">
              <SeloStatus status={t.status} />
              <p className="mt-1 font-mono text-lg font-medium tabular-nums">{moeda(t.valor, t.moeda)}</p>
            </div>
          ))}
        </section>
      )}

      {painel.matriculadasSemComissao.length > 0 && (
        <section aria-label="Matrículas sem comissão" className="rounded-lg border border-border-soft p-3 text-sm">
          <h2 className="font-medium">Matriculadas sem comissão</h2>
          <p className="text-xs text-gray-600">Pendências de todos os períodos{vendedorId ? ", só do vendedor filtrado" : ""}.</p>
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
          <div className="overflow-x-auto rounded-lg border border-border-soft">
            <table className="w-full text-left text-sm">
              <thead className="bg-surface-muted text-left text-xs text-gray-600">
                <tr>
                  <th scope="col" className="px-4 py-2 font-medium">Vendedor</th>
                  <th scope="col" className="px-4 py-2 font-medium">Quantidade</th>
                  <th scope="col" className="px-4 py-2 font-medium">Valor</th>
                </tr>
              </thead>
              <tbody>
                {painel.porVendedor.map((v) => (
                  <tr key={`${v.vendedorId}-${v.moeda}`} className="border-t border-border-soft transition-colors hover:bg-surface-muted">
                    <td className="px-4 py-2"><ComAvatar nome={v.nome}>{v.nome}</ComAvatar></td>
                    <td className="px-4 py-2"><span className="font-mono tabular-nums">{v.quantidade}</span> {v.quantidade === 1 ? "comissão" : "comissões"}</td>
                    <td className="px-4 py-2 font-mono font-medium tabular-nums">{moeda(v.valor, v.moeda)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {veTodos && painel.porPolitica.length > 0 && (
        <section aria-label="Por política" className="space-y-1 text-sm">
          <h2 className="font-medium">Por política</h2>
          <ul className="divide-y divide-border-soft rounded-lg border border-border-soft">
            {painel.porPolitica.map((p) => (
              <li key={`${p.politicaId ?? "sem"}-${p.moeda}`} className="flex flex-wrap justify-between gap-2 p-3">
                <span>{p.rotulo}</span>
                <span className="font-mono font-medium tabular-nums">{moeda(p.valor, p.moeda)}</span>
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
                <span className="font-mono font-medium tabular-nums">{moeda(e.valor, e.moeda)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section aria-label="Comissões do período" className="space-y-2">
        <h2 className="font-medium">Comissões do período</h2>
        <p className="text-xs text-gray-600">Previsão de pagamento: dia {painel.diaPrevisaoPagamento} do mês seguinte à competência, no fuso da escola.</p>
        {painel.linhas.length === 0 ? (
          <EstadoVazio bloco>{filtrando ? "Nenhuma comissão com esses filtros." : "Nenhuma comissão neste período."}</EstadoVazio>
        ) : (
          <>
            <div className="hidden overflow-x-auto rounded-lg border border-border-soft md:block">
              <table className="hidden w-full text-left text-sm md:table">
                <thead className="bg-surface-muted text-left text-xs text-gray-600">
                  <tr>
                    <th scope="col" className="px-4 py-2 font-medium">Aluno</th>
                    <th scope="col" className="px-4 py-2 font-medium">Produto</th>
                    <th scope="col" className="px-4 py-2 font-medium">Beneficiário</th>
                    <th scope="col" className="px-4 py-2 font-medium">Cálculo</th>
                    <th scope="col" className="px-4 py-2 font-medium">Valor</th>
                    <th scope="col" className="px-4 py-2 font-medium">Situação</th>
                    <th scope="col" className="px-4 py-2 font-medium">Competência</th>
                    <th scope="col" className="px-4 py-2 font-medium">Previsão de pagamento</th>
                    {podeEstornar && <th scope="col" className="px-4 py-2 font-medium">Ações</th>}
                  </tr>
                </thead>
                <tbody>
                  {painel.linhas.map((l) => (
                    <tr key={l.id} className="border-t border-border-soft transition-colors hover:bg-surface-muted">
                      <td className="px-4 py-2"><ComAvatar nome={l.nome}><NomeDoAluno l={l} podeAbrirPreparacao={podeAbrirPreparacao} /></ComAvatar></td>
                      <td className="px-4 py-2">{l.produto}</td>
                      <td className="px-4 py-2"><ComAvatar nome={l.vendedor}>{l.vendedor}</ComAvatar></td>
                      <td className="px-4 py-2 font-mono tabular-nums">{calculo(l)}</td>
                      <td className="px-4 py-2 font-mono tabular-nums">{moeda(l.valor, l.moeda)}</td>
                      <td className="px-4 py-2"><SeloStatus status={l.status} /></td>
                      <td className="px-4 py-2 font-mono tabular-nums">{dia(l.competencia, fuso)}</td>
                      <td className="px-4 py-2">{l.previsaoPagamento ? <span className="font-mono tabular-nums">{diaCivil(l.previsaoPagamento)}</span> : "—"}</td>
                      {podeEstornar && <td className="px-4 py-2">{estornavel(l.status) && <EstornarComissao id={l.id} aluno={l.nome} valor={moeda(l.valor, l.moeda)} />}</td>}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <ul className="space-y-2 md:hidden">
              {painel.linhas.map((l) => (
                <li key={l.id} className="space-y-1 rounded-lg border border-border-soft p-3 text-sm">
                  <p className="font-medium"><ComAvatar nome={l.nome}><NomeDoAluno l={l} podeAbrirPreparacao={podeAbrirPreparacao} /></ComAvatar></p>
                  <p className="flex flex-wrap items-center gap-2 text-gray-600"><span>{l.produto}</span><ComAvatar nome={l.vendedor}>{l.vendedor}</ComAvatar></p>
                  <LinhaCampo icone={<IconCalculator size={18} />} valor={calculo(l)} rotulo="Cálculo" mono />
                  <p className="flex flex-wrap items-center justify-between gap-2"><span className="font-mono font-medium tabular-nums">{moeda(l.valor, l.moeda)}</span><SeloStatus status={l.status} /></p>
                  <p className="font-mono text-xs tabular-nums text-gray-600">{dia(l.competencia, fuso)}{l.previsaoPagamento && <> · previsão de pagamento {diaCivil(l.previsaoPagamento)}</>}</p>
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
