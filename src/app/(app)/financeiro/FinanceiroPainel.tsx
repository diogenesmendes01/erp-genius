"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { StatusComissao, TipoAprovacao, Vigencia } from "@prisma/client";
import { STATUS_COMISSAO_LABEL, rotular } from "@/lib/labels";
import { formatarMoeda, formatarValores, somarPorMoeda, consolidar, type ValorMoeda } from "@/lib/dinheiro";
import type { CotacaoVigente, relatorioDescontosComissoes } from "@/server/financeiro/consultas";
import { fecharMesComissoes, salvarConfigFinanceiro, salvarTaxasCambio, atualizarCotacoesAutomatico } from "@/server/financeiro/acoes";
import { decidirAprovacao } from "@/server/ajustes/acoes";
import { formatarInstanteExibicao } from "@/server/operacao/fuso-exibicao";
import { FeedbackAcao } from "@/components/FeedbackAcao";
import { useAcaoCliente } from "@/lib/acao-cliente";
import type { Resultado } from "@/server/_shared/resultado";
import { botaoClasses } from "@/components/Botao";
import { EstadoVazio, EstadoVazioLinha } from "@/components/EstadoVazio";

export type RelatorioDados = Awaited<ReturnType<typeof relatorioDescontosComissoes>>;
const MOEDA_CONS_KEY = "erpgenius:moedaConsolidacao";

export interface ComissaoRow {
  id: string;
  vendedor: string;
  valor: number;
  moeda: string;
  percentual: number;
  tipo?: "PERCENTUAL" | "VALOR_FIXO";
  status: StatusComissao;
}
export interface Kpis {
  recebidoMes: ValorMoeda[];
  emAtraso: ValorMoeda[];
  aReceber: ValorMoeda[];
  comissoesAPagar: ValorMoeda[];
  novasMatriculas: number;
}
export interface AprovacaoRow {
  id: string;
  solicitante: string;
  tipo: TipoAprovacao;
  motivo: string;
  vigencia: Vigencia | null;
  impactoMensal: number;
  alunoNome: string;
  valorDe: number;
  valorPara: number;
  descontoValor: number;
  moeda: string;
}

const TIPO_APROV_LABEL: Record<TipoAprovacao, string> = {
  DESCONTO: "Desconto",
  BOLSA: "Bolsa",
  ALTERACAO_VALOR: "Alteração de valor",
  PERDAO_DIVIDA: "Perdão de dívida",
  COMISSAO_EXCEPCIONAL: "Comissão excepcional",
};
// Sem emoji: labels usadas dentro de <select>, onde não cabe ícone JSX (design denso).
const VIGENCIA_LABEL: Record<Vigencia, string> = {
  ESTA_COBRANCA: "Esta cobrança",
  PROXIMOS_MESES: "Próximos meses",
  CONTRATO_INTEIRO: "Contrato inteiro",
};

const btnPri = botaoClasses();
const btnSec = botaoClasses({ variante: "secundario", tamanho: "sm" });

// Abas do /financeiro como componentes independentes (E8 — uma rota por aba). Cada rota monta só a
// sua aba; as que executam ações carregam o próprio executor (useAcaoCliente) e o próprio retorno.
// Câmbio, fechamento de comissões, configuração e aprovações: nenhuma action recebe chave de
// idempotência — resultado incerto manda conferir antes de repetir.

function useExecutorFinanceiro() {
  const router = useRouter();
  const acao = useAcaoCliente({ idempotente: false });
  // Recebe uma fábrica, não a promise já criada: com a trava do executor fechada, a action nem começa.
  async function run<T>(disparar: () => Promise<Resultado<T>>) {
    const d = await acao.executar(disparar);
    if (d?.tipo === "ok") router.refresh();
  }
  return { acao, run, router };
}

export function ComissoesAba({ comissoes, aPagar, podePagar, fechamentoAutomatico, vazio }: { comissoes: ComissaoRow[]; aPagar: ValorMoeda[]; podePagar: boolean; fechamentoAutomatico: boolean; vazio?: ReactNode }) {
  const { acao, run } = useExecutorFinanceiro();
  return (
    <>
      <FeedbackAcao erro={acao.erro} sucesso={acao.sucesso} className="mb-4" />
      <Comissoes
        comissoes={comissoes}
        aPagar={aPagar}
        vazio={vazio}
        podePagar={podePagar}
        onFechar={() => run(() => fecharMesComissoes())}
        fechamentoAutomatico={fechamentoAutomatico}
        onToggleAutomatico={(ligado) => run(() => salvarConfigFinanceiro({ fechamentoComissaoAutomatico: ligado }))}
        isPending={acao.ocupado}
      />
    </>
  );
}

export function AprovacoesAba({ aprovacoes }: { aprovacoes: AprovacaoRow[] }) {
  const { acao, run } = useExecutorFinanceiro();
  return (
    <>
      <FeedbackAcao erro={acao.erro} sucesso={acao.sucesso} className="mb-4" />
      <Aprovacoes aprovacoes={aprovacoes} onDecidir={(id, ok) => run(() => decidirAprovacao(id, { aprovar: ok }))} isPending={acao.ocupado} />
    </>
  );
}

export function CambioAba({ cotacoes, preferenciaFusoExibicao = null }: { cotacoes: CotacaoVigente[]; preferenciaFusoExibicao?: string | null }) {
  const { acao, router } = useExecutorFinanceiro();
  async function salvarCambio(entradas: { moeda: string; unidadesPorUsd: number }[]) {
    const d = await acao.executar(() => salvarTaxasCambio({ entradas }), "Cotações salvas.");
    if (d?.tipo === "ok") router.refresh();
  }
  async function atualizarCambioAuto() {
    const d = await acao.executar(() => atualizarCotacoesAutomatico(), (dado) => {
      const semCot = dado?.semCotacao ?? [];
      return `Cotações atualizadas pela fonte pública: ${dado?.atualizadas ?? 0}` + (semCot.length ? ` · sem cotação na fonte: ${semCot.join(", ")}` : "");
    });
    if (d?.tipo === "ok") router.refresh();
  }
  return (
    <>
      <FeedbackAcao erro={acao.erro} sucesso={acao.sucesso} className="mb-4" />
      <CambioPainel cotacoes={cotacoes} onSalvar={salvarCambio} onAtualizarAuto={atualizarCambioAuto} preferenciaFusoExibicao={preferenciaFusoExibicao} />
    </>
  );
}

/** Visão geral com o seletor de moeda de consolidação (Fase B): preferência salva no navegador. */
export function GeralAba({ kpis, cotacoes }: { kpis: Kpis; cotacoes: CotacaoVigente[] }) {
  // `taxas` = moeda→unidadesPorUsd para o pivô USD em `consolidar`.
  const taxas = useMemo(() => {
    const r: Record<string, number> = {};
    for (const c of cotacoes) if (c.unidadesPorUsd != null) r[c.moeda] = c.unidadesPorUsd;
    return r;
  }, [cotacoes]);
  const opcoesMoeda = useMemo(() => cotacoes.map((c) => c.moeda), [cotacoes]);
  const [moedaCons, setMoedaCons] = useState("USD");
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(MOEDA_CONS_KEY);
      if (saved && cotacoes.some((c) => c.moeda === saved)) setMoedaCons(saved);
    } catch { /* storage indisponível */ }
  }, [cotacoes]);
  function escolherMoeda(m: string) {
    setMoedaCons(m);
    try { window.localStorage.setItem(MOEDA_CONS_KEY, m); } catch { /* storage indisponível */ }
  }
  return <VisaoGeral kpis={kpis} opcoes={opcoesMoeda} taxas={taxas} moedaCons={moedaCons} onMoeda={escolherMoeda} />;
}

export function Comissoes({
  comissoes,
  aPagar,
  vazio,
  podePagar,
  onFechar,
  fechamentoAutomatico,
  onToggleAutomatico,
  isPending,
}: {
  comissoes: ComissaoRow[];
  /** Total das aprovadas em TODO o escopo (servidor) — a lista é paginada. */
  aPagar: ValorMoeda[];
  podePagar: boolean;
  onFechar: () => void;
  fechamentoAutomatico: boolean;
  onToggleAutomatico: (ligado: boolean) => void;
  isPending: boolean;
  /** Texto da lista vazia — com filtro ativo, a página diz que não há nesta situação e oferece ver todas. */
  vazio?: ReactNode;
}) {
  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-gray-500">A pagar (aprovadas): <strong>{formatarValores(aPagar)}</strong></p>
        {podePagar && <span className="flex items-center gap-3">
          {/* Fase 2 (doc 03): fechamento MENSAL automático — 1x por mês, no 1º tick do cron. */}
          <label className="flex items-center gap-1.5 text-xs text-gray-600">
            <input
              type="checkbox"
              className="h-4 w-4 accent-brand-600"
              checked={fechamentoAutomatico}
              disabled={isPending}
              onChange={(e) => onToggleAutomatico(e.target.checked)}
            />
            Fechamento mensal automático
          </label>
          {/* `isPending` também fica true durante o toggle de fechamento automático (mesma
              trava de `run`) — texto fixo, não "Fechando…", para não afirmar uma operação que
              pode não ser esta. */}
          <button className={btnPri} disabled={isPending} onClick={onFechar}>
            Fechar mês e marcar pagas
          </button>
        </span>}
      </div>
      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left text-xs text-gray-500">
            <tr>
              <th className="px-4 py-2 font-medium">Vendedor</th>
              <th className="px-4 py-2 font-medium">%</th>
              <th className="px-4 py-2 font-medium">Valor</th>
              <th className="px-4 py-2 font-medium">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {comissoes.length === 0 ? (
              <EstadoVazioLinha colSpan={4}>{vazio ?? "Sem comissões."}</EstadoVazioLinha>
            ) : (
              comissoes.map((c) => (
                <tr key={c.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-gray-800">{c.vendedor}</td>
                  <td className="px-4 py-3 text-gray-600">{c.tipo === "VALOR_FIXO" ? "Fixa" : `${c.percentual}%`}</td>
                  <td className="px-4 py-3 text-gray-700">{formatarMoeda(c.valor, c.moeda)}</td>
                  <td className="px-4 py-3 text-gray-600">{STATUS_COMISSAO_LABEL[c.status]}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function Aprovacoes({
  aprovacoes,
  onDecidir,
  isPending,
}: {
  aprovacoes: AprovacaoRow[];
  onDecidir: (id: string, aprovar: boolean) => void;
  isPending: boolean;
}) {
  const impactoMensal = somarPorMoeda(aprovacoes.map((a) => ({ moeda: a.moeda, valor: a.impactoMensal })));
  const impactoAnual = impactoMensal.map((v) => ({ moeda: v.moeda, valor: v.valor * 12 }));
  return (
    <div>
      <div className="mb-3 flex flex-wrap gap-4 text-sm text-gray-600">
        <span>Pendentes: <strong>{aprovacoes.length}</strong></span>
        <span>Impacto mensal: <strong>{formatarValores(impactoMensal)}</strong></span>
        <span>Impacto anual: <strong>{formatarValores(impactoAnual)}</strong></span>
      </div>
      {aprovacoes.length === 0 ? (
        <EstadoVazio bloco>Nenhum pedido pendente.</EstadoVazio>
      ) : (
        <ul className="flex flex-col gap-2">
          {aprovacoes.map((a) => (
            <li key={a.id} className="rounded-lg border border-gray-200 bg-surface p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="text-sm">
                  <div className="font-medium text-gray-800">
                    {a.alunoNome} — {TIPO_APROV_LABEL[a.tipo]}
                  </div>
                  <div className="text-gray-600">
                    {formatarMoeda(a.valorDe, a.moeda)} → {formatarMoeda(a.valorPara, a.moeda)}{" "}
                    <span className="text-gray-500">(desconto {formatarMoeda(a.descontoValor, a.moeda)})</span>
                  </div>
                  <div className="text-xs text-gray-500">
                    {a.vigencia ? VIGENCIA_LABEL[a.vigencia] + " · " : ""}solicitante: {a.solicitante}
                    {a.motivo ? ` · ${a.motivo}` : ""}
                  </div>
                </div>
                <div className="flex shrink-0 gap-2">
                  <button
                    onClick={() => onDecidir(a.id, true)}
                    disabled={isPending}
                    className={botaoClasses({ tamanho: "sm" })}
                  >
                    Aprovar
                  </button>
                  <button
                    onClick={() => onDecidir(a.id, false)}
                    disabled={isPending}
                    className={botaoClasses({ variante: "secundario", tamanho: "sm" })}
                  >
                    Rejeitar
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ValoresEmpilhados({ valores }: { valores: ValorMoeda[] }) {
  if (valores.length === 0) return <div className="text-2xl font-medium text-gray-300">—</div>;
  return (
    <div className="flex flex-col leading-tight">
      {valores.map((v) => (
        <span key={v.moeda} className="text-xl font-medium text-gray-800">{formatarMoeda(v.valor, v.moeda)}</span>
      ))}
    </div>
  );
}

export function VisaoGeral({
  kpis,
  opcoes,
  taxas,
  moedaCons,
  onMoeda,
}: {
  kpis: Kpis;
  opcoes: string[];
  taxas: Record<string, number>;
  moedaCons: string;
  onMoeda: (m: string) => void;
}) {
  const cards = [
    ["Recebido no mês", kpis.recebidoMes],
    ["A receber", kpis.aReceber],
    ["Em atraso", kpis.emAtraso],
    ["Comissões a pagar", kpis.comissoesAPagar],
  ] as const;
  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <span id="financeiro-consolidar-rotulo" className="text-sm text-gray-500">Consolidar em</span>
        <select
          aria-labelledby="financeiro-consolidar-rotulo"
          value={moedaCons}
          onChange={(e) => onMoeda(e.target.value)}
          className="rounded-md border border-gray-300 px-2 py-1 text-sm outline-none focus:border-brand-500"
        >
          {opcoes.map((m) => <option key={m} value={m}>{m}</option>)}
        </select>
        <span className="text-xs text-gray-400">câmbio de referência · só leitura</span>
      </div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {cards.map(([t, valores]) => {
          const c = consolidar(valores, moedaCons, taxas);
          return (
            <div key={t} className="rounded-lg border border-gray-200 bg-surface p-4">
              <ValoresEmpilhados valores={valores} />
              {valores.length > 0 && (
                <div className="mt-0.5 text-xs text-gray-500">
                  ≈ {formatarMoeda(c.valor, moedaCons)}
                  {c.faltando.length > 0 && (
                    <span className="text-amber-600"> · faltam taxas: {c.faltando.join(", ")}</span>
                  )}
                </div>
              )}
              <div className="mt-1 text-xs text-gray-500">{t}</div>
            </div>
          );
        })}
      </div>
      <p className="mt-4 text-sm text-gray-500">Novas matrículas no mês: <strong>{kpis.novasMatriculas}</strong></p>
      <p className="mt-1 text-xs text-gray-400">
        Os valores por moeda são exatos. O consolidado &ldquo;≈&rdquo; é conversão de referência (câmbio manual), só para leitura — nunca entra na conta do aluno.
      </p>
    </div>
  );
}

export function CambioPainel({
  cotacoes,
  onSalvar,
  onAtualizarAuto,
  preferenciaFusoExibicao,
}: {
  cotacoes: CotacaoVigente[];
  onSalvar: (entradas: { moeda: string; unidadesPorUsd: number }[]) => Promise<void>;
  onAtualizarAuto: () => Promise<void>;
  preferenciaFusoExibicao?: string | null;
}) {
  const editaveis = cotacoes.filter((c) => !c.pivo);
  const [vals, setVals] = useState<Record<string, string>>(() =>
    Object.fromEntries(editaveis.map((c) => [c.moeda, c.unidadesPorUsd != null ? String(c.unidadesPorUsd) : ""])),
  );
  const [salvando, setSalvando] = useState(false);
  const [auto, setAuto] = useState(false);

  // Após salvar/atualizar, o pai dá router.refresh() com novas cotações → resincroniza os inputs
  // com o valor canônico (senão o campo ficaria com o texto antigo digitado).
  useEffect(() => {
    setVals(Object.fromEntries(editaveis.map((c) => [c.moeda, c.unidadesPorUsd != null ? String(c.unidadesPorUsd) : ""])));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cotacoes]);

  async function salvar() {
    const entradas = Object.entries(vals)
      .filter(([, v]) => v.trim() !== "" && Number(v) > 0)
      .map(([moeda, v]) => ({ moeda, unidadesPorUsd: Number(v) }));
    if (entradas.length === 0) return;
    setSalvando(true);
    await onSalvar(entradas);
    setSalvando(false);
  }

  async function atualizar() {
    setAuto(true);
    await onAtualizarAuto();
    setAuto(false);
  }

  return (
    <div className="max-w-xl">
      <p className="mb-1 text-sm text-gray-600">Cotação de referência por moeda</p>
      <p className="mb-4 text-xs text-gray-400">
        Quantas unidades de cada moeda equivalem a <strong>1 US$</strong> (pivô). Usado só na consolidação
        gerencial — nunca na conta do aluno. Cada alteração grava uma nova cotação (mantém histórico).
      </p>
      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left text-xs text-gray-500">
            <tr>
              <th className="px-4 py-2 font-medium">Moeda</th>
              <th className="px-4 py-2 font-medium">1 US$ =</th>
              <th className="px-4 py-2 font-medium">Atualizado</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            <tr>
              <td className="px-4 py-2 font-medium text-gray-700">USD <span className="text-xs text-gray-400">(pivô)</span></td>
              <td className="px-4 py-2 text-gray-500">1</td>
              <td className="px-4 py-2 text-xs text-gray-400">fixo</td>
            </tr>
            {editaveis.map((c) => (
              <tr key={c.moeda}>
                <td className="px-4 py-2 font-medium text-gray-700">{c.moeda}</td>
                <td className="px-4 py-2">
                  <input
                    type="number"
                    step="0.0001"
                    min="0"
                    aria-label={`Cotação: 1 US$ em ${c.moeda}`}
                    value={vals[c.moeda] ?? ""}
                    onChange={(e) => setVals((v) => ({ ...v, [c.moeda]: e.target.value }))}
                    placeholder="ex.: 512"
                    className="w-32 rounded-md border border-gray-300 px-2 py-1 text-sm outline-none focus:border-brand-500"
                  />
                </td>
                <td className="px-4 py-2 text-xs text-gray-400">
                  {c.vigenteEm ? (() => { const exibicao = formatarInstanteExibicao(c.vigenteEm, preferenciaFusoExibicao, "UTC"); return `${exibicao.texto} (horário exibido em ${exibicao.fuso}; origem UTC)`; })() : "sem cotação"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button className={btnPri} disabled={salvando || auto} onClick={salvar}>
          {salvando ? "Salvando…" : "Salvar cotações"}
        </button>
        <button className={btnSec} disabled={auto || salvando} onClick={atualizar}>
          {auto ? "Atualizando…" : "Atualizar automaticamente"}
        </button>
        <span className="text-xs text-gray-400">fonte pública (open.er-api.com) · base USD</span>
      </div>
    </div>
  );
}

export function Descontos({ relatorio }: { relatorio: RelatorioDados }) {
  const { descontoPorMoeda, descontoPorVendedor, comissoesPorStatus, comissoesPorVendedor } = relatorio;
  const vazio = descontoPorMoeda.length === 0 && comissoesPorStatus.length === 0;
  if (vazio) {
    return (
      <EstadoVazio bloco>Ainda não há descontos nem comissões registrados.</EstadoVazio>
    );
  }
  return (
    <div className="flex flex-col gap-6">
      <section>
        <h2 className="mb-2 text-sm font-medium text-gray-700">Desconto concedido por moeda</h2>
        {descontoPorMoeda.length === 0 ? (
          <EstadoVazio>Sem descontos.</EstadoVazio>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-gray-200">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-left text-xs text-gray-500">
                <tr>
                  <th className="px-4 py-2 font-medium">Moeda</th>
                  <th className="px-4 py-2 font-medium">Total concedido</th>
                  <th className="px-4 py-2 font-medium">Ajustes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {descontoPorMoeda.map((d) => (
                  <tr key={d.moeda}>
                    <td className="px-4 py-2 font-medium text-gray-700">{d.moeda}</td>
                    <td className="px-4 py-2 text-gray-700">{formatarMoeda(d.total, d.moeda)}</td>
                    <td className="px-4 py-2 text-gray-500">{d.qtd}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section>
        {/* Fase 2 (doc 03 §Comissão): apuração POR VENDEDOR (moeda × status). */}
        <h2 className="mb-2 text-sm font-medium text-gray-700">Comissão por vendedor</h2>
        {comissoesPorVendedor.length === 0 ? (
          <EstadoVazio>Sem comissões.</EstadoVazio>
        ) : (
          <div className="mb-6 overflow-x-auto rounded-lg border border-gray-200">
            <table className="w-full min-w-[640px] text-sm">
              <thead className="bg-gray-50 text-left text-xs text-gray-500">
                <tr>
                  <th className="px-4 py-2 font-medium">Vendedor</th>
                  <th className="px-4 py-2 font-medium">Moeda</th>
                  <th className="px-4 py-2 font-medium">Status</th>
                  <th className="px-4 py-2 font-medium">Total</th>
                  <th className="px-4 py-2 font-medium">Qtd</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {comissoesPorVendedor.map((c, i) => (
                  <tr key={i}>
                    <td className="px-4 py-2 font-medium text-gray-700">{c.vendedor}</td>
                    <td className="px-4 py-2 text-gray-700">{c.moeda}</td>
                    <td className="px-4 py-2 text-gray-500">{rotular(STATUS_COMISSAO_LABEL, c.status)}</td>
                    <td className="px-4 py-2 text-gray-700">{formatarMoeda(c.total, c.moeda)}</td>
                    <td className="px-4 py-2 text-gray-500">{c.qtd}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <h2 className="mb-2 text-sm font-medium text-gray-700">Desconto por vendedor</h2>
        {descontoPorVendedor.length === 0 ? (
          <EstadoVazio>Sem descontos por vendedor.</EstadoVazio>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-gray-200">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-left text-xs text-gray-500">
                <tr>
                  <th className="px-4 py-2 font-medium">Vendedor</th>
                  <th className="px-4 py-2 font-medium">Moeda</th>
                  <th className="px-4 py-2 font-medium">Total concedido</th>
                  <th className="px-4 py-2 font-medium">Ajustes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {descontoPorVendedor.map((d, i) => (
                  <tr key={`${d.vendedor}-${d.moeda}-${i}`}>
                    <td className="px-4 py-2 text-gray-700">{d.vendedor}</td>
                    <td className="px-4 py-2 text-gray-600">{d.moeda}</td>
                    <td className="px-4 py-2 text-gray-700">{formatarMoeda(d.total, d.moeda)}</td>
                    <td className="px-4 py-2 text-gray-500">{d.qtd}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-2 text-sm font-medium text-gray-700">Comissão por moeda e status</h2>
        {comissoesPorStatus.length === 0 ? (
          <EstadoVazio>Sem comissões.</EstadoVazio>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-gray-200">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-left text-xs text-gray-500">
                <tr>
                  <th className="px-4 py-2 font-medium">Moeda</th>
                  <th className="px-4 py-2 font-medium">Status</th>
                  <th className="px-4 py-2 font-medium">Total</th>
                  <th className="px-4 py-2 font-medium">Qtde</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {comissoesPorStatus.map((c, i) => (
                  <tr key={`${c.moeda}-${c.status}-${i}`}>
                    <td className="px-4 py-2 font-medium text-gray-700">{c.moeda}</td>
                    <td className="px-4 py-2 text-gray-600">{STATUS_COMISSAO_LABEL[c.status]}</td>
                    <td className="px-4 py-2 text-gray-700">{formatarMoeda(c.total, c.moeda)}</td>
                    <td className="px-4 py-2 text-gray-500">{c.qtd}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

