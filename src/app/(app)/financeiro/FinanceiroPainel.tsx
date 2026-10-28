"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { StatusComissao, TipoAprovacao, Vigencia } from "@prisma/client";
import { IconUser } from "@tabler/icons-react";
import { STATUS_COMISSAO_LABEL, TIPO_APROVACAO_LABEL, VIGENCIA_LABEL } from "@/lib/labels";
import { formatarMoeda, formatarValores, somarPorMoeda, consolidar, type ValorMoeda } from "@/lib/dinheiro";
import type { CotacaoVigente, relatorioDescontosComissoes } from "@/server/financeiro/consultas";
import { fecharMesComissoes, salvarConfigFinanceiro, salvarTaxasCambio, atualizarCotacoesAutomatico } from "@/server/financeiro/acoes";
import { decidirAprovacao } from "@/server/ajustes/acoes";
import { decidirPrecoPreparacao } from "@/server/matricula/preparacao-preco";
import { Avatar } from "@/components/Avatar";
import { BadgeEstado, type TomEstado } from "@/components/BadgeEstado";
import { CONTROLE_CAMPO } from "@/components/Campo";
import { CampoTexto } from "@/components/CampoTexto";
import { LinhaCampo } from "@/components/LinhaCampo";
import { formatarInstanteExibicao } from "@/server/operacao/fuso-exibicao";
import { FeedbackAcao } from "@/components/FeedbackAcao";
import { ConfirmarAcao } from "@/components/ConfirmarAcao";
import { useAcaoCliente } from "@/lib/acao-cliente";
import { useChaveIdempotencia } from "@/lib/chave-idempotencia";
import type { Resultado } from "@/server/_shared/resultado";
import { botaoClasses } from "@/components/Botao";
import { EstadoVazio, EstadoVazioLinha } from "@/components/EstadoVazio";
import { ColunaOrdenavel } from "@/components/ColunaOrdenavel";
import type { Ordenacao } from "@/lib/ordenacao";
import type { OrdemComissoes } from "@/server/financeiro/ordem-comissoes";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
export type RelatorioDados = Awaited<ReturnType<typeof relatorioDescontosComissoes>>;
const MOEDA_CONS_KEY = "erpgenius:moedaConsolidacao";

export interface OrdenacaoComissoes {
  atual: Ordenacao<OrdemComissoes>;
  rota: string;
  parametros: Record<string, string>;
}

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
  origem?: "APROVACAO_COBRANCA" | "PREPARACAO_MATRICULA";
  matriculaId?: string;
  preparacaoId?: string;
  podeAprovarDireto?: boolean;
}

const btnPri = botaoClasses();
const btnSec = botaoClasses({ variante: "secundario", tamanho: "sm" });
const TOM_STATUS: Record<StatusComissao, TomEstado> = {
  PENDENTE: "aviso",
  APROVADA: "aprovacao",
  PAGA: "sucesso",
  ESTORNADA: "perigo",
};
const CABECALHO_TABELA = "bg-surface-muted text-left text-xs text-gray-600";
const LINHA_TABELA = "transition-colors hover:bg-surface-muted";

function SeloComissao({ status }: { status: StatusComissao }) {
  return <BadgeEstado tom={TOM_STATUS[status]} ponto>{STATUS_COMISSAO_LABEL[status]}</BadgeEstado>;
}

function Pessoa({ nome }: { nome: string }) {
  return <span className="inline-flex items-center gap-2"><Avatar nome={nome} tamanho={32} />{nome}</span>;
}

function useExecutorFinanceiro() {
  const router = useRouter();
  const acao = useAcaoCliente({ idempotente: false });
  async function run<T>(disparar: () => Promise<Resultado<T>>) {
    const d = await acao.executar(disparar);
    if (d?.tipo === "ok") router.refresh();
  }
  return { acao, run, router };
}

export type TotalAPagar = ValorMoeda & { quantidade: number };

export function ComissoesAba({ comissoes, aPagar, podePagar, fechamentoAutomatico, vazio, ordenacao }: { comissoes: ComissaoRow[]; aPagar: (ValorMoeda | TotalAPagar)[]; podePagar: boolean; fechamentoAutomatico: boolean; vazio?: ReactNode; ordenacao?: OrdenacaoComissoes }) {
  const { acao, run, router } = useExecutorFinanceiro();
  const [confirmarFechamento, setConfirmarFechamento] = useState(false);
  const tentativaFechamento = useChaveIdempotencia();
  const quantidade = aPagar.reduce((n: number, v: ValorMoeda | TotalAPagar) => n + ("quantidade" in v ? v.quantidade : 0), 0);
  return (
    <>
      <FeedbackAcao erro={acao.erro} sucesso={acao.sucesso} className="mb-4" />
      <Comissoes
        comissoes={comissoes}
        aPagar={aPagar}
        vazio={vazio}
        ordenacao={ordenacao}
        podePagar={podePagar}
        onFechar={() => { acao.limpar(); setConfirmarFechamento(true); }}
        fechamentoAutomatico={fechamentoAutomatico}
        onToggleAutomatico={(ligado) => run(() => salvarConfigFinanceiro({ fechamentoComissaoAutomatico: ligado }))}
        isPending={acao.ocupado}
      />
      {confirmarFechamento && (
        <ConfirmarAcao
          titulo="Fechar o mês e marcar as comissões aprovadas como pagas?"
          confirmacao="fechamento do mês"
          idempotente
          acao={() => fecharMesComissoes({ chaveIdempotencia: tentativaFechamento.atual })}
          aoConcluir={(d: { pagas: number } | undefined) => {
            tentativaFechamento.depoisDo({ tipo: "ok" });
            const pagas = d?.pagas ?? 0;
            setConfirmarFechamento(false);
            acao.setSucesso(pagas === 1 ? "Mês fechado: 1 comissão marcada como paga." : `Mês fechado: ${pagas} comissões marcadas como pagas.`);
            router.refresh();
          }}
          aoCancelar={() => setConfirmarFechamento(false)}
        >
          <p>
            {quantidade > 0
              ? <><strong>{quantidade} {quantidade === 1 ? "comissão aprovada" : "comissões aprovadas"}</strong> {quantidade === 1 ? "passa a paga" : "passam a pagas"}, total <strong>{formatarValores(aPagar)}</strong>.</>
              : <>Todas as comissões aprovadas passam a pagas, total <strong>{formatarValores(aPagar)}</strong>.</>}
          </p>
          <p>Entram todas as aprovadas até agora, inclusive as que não aparecem na página atual da lista. Não há desfazer pela tela.</p>
        </ConfirmarAcao>
      )}
    </>
  );
}

export function AprovacoesAba({ aprovacoes }: { aprovacoes: AprovacaoRow[] }) {
  const { acao, run } = useExecutorFinanceiro();
  return (
    <>
      <FeedbackAcao erro={acao.erro} sucesso={acao.sucesso} className="mb-4" />
      <Aprovacoes aprovacoes={aprovacoes} onDecidir={(id, ok, motivo) => {
        const row = aprovacoes.find((a) => a.id === id);
        const preparacaoId = row?.preparacaoId;
        if (row?.origem === "PREPARACAO_MATRICULA" && preparacaoId) {
          return run(() => decidirPrecoPreparacao({ preparacaoId, aprovar: ok, motivo: (motivo ?? "").trim() }));
        }
        return run(() => decidirAprovacao(id, { aprovar: ok, ...(motivo ? { motivo } : {}) }));
      }} isPending={acao.ocupado} />
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

export function GeralAba({ kpis, cotacoes }: { kpis: Kpis; cotacoes: CotacaoVigente[] }) {
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
    } catch {  }
  }, [cotacoes]);
  function escolherMoeda(m: string) {
    setMoedaCons(m);
    try { window.localStorage.setItem(MOEDA_CONS_KEY, m); } catch {  }
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
  ordenacao,
}: {
  comissoes: ComissaoRow[];
  aPagar: ValorMoeda[];
  podePagar: boolean;
  onFechar: () => void;
  fechamentoAutomatico: boolean;
  onToggleAutomatico: (ligado: boolean) => void;
  isPending: boolean;
  vazio?: ReactNode;
  ordenacao?: OrdenacaoComissoes;
}) {
  const coluna = ordenacao ? { ordenacao: ordenacao.atual, rota: ordenacao.rota, parametros: ordenacao.parametros } : null;
  const cabecalho = (campo: OrdemComissoes, rotulo: string, direcaoInicial?: "asc" | "desc") =>
    coluna ? <ColunaOrdenavel campo={campo} rotulo={rotulo} direcaoInicial={direcaoInicial} {...coluna} /> : <TableHead className="px-4 py-2 font-medium">{rotulo}</TableHead>;
  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-gray-500"><span className="font-mono tabular-nums">A pagar (aprovadas): <strong>{formatarValores(aPagar)}</strong></span></p>
        {podePagar && <span className="flex items-center gap-3">
          <label className="flex items-center gap-1.5 text-xs text-gray-600">
            <Switch checked={fechamentoAutomatico} disabled={isPending} onCheckedChange={(marcado) => onToggleAutomatico((marcado === true))} />
            Fechamento mensal automático
          </label>
          <button className={btnPri} disabled={isPending} onClick={onFechar}>
            Fechar mês e marcar pagas
          </button>
        </span>}
      </div>
      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <Table className="w-full text-sm">
          <TableHeader className={CABECALHO_TABELA}>
            <TableRow>
              {cabecalho("vendedor", "Vendedor")}
              <TableHead className="px-4 py-2 font-medium">%</TableHead>
              {cabecalho("valor", "Valor", "desc")}
              {cabecalho("status", "Status")}
            </TableRow>
          </TableHeader>
          <TableBody className="divide-y divide-gray-100">
            {comissoes.length === 0 ? (
              <EstadoVazioLinha colSpan={4}>{vazio ?? "Sem comissões."}</EstadoVazioLinha>
            ) : (
              comissoes.map((c) => (
                <TableRow key={c.id} className={LINHA_TABELA}>
                  <TableCell className="px-4 py-3 text-gray-800"><Pessoa nome={c.vendedor} /></TableCell>
                  <TableCell className="px-4 py-3 font-mono tabular-nums text-gray-600">{c.tipo === "VALOR_FIXO" ? "Fixa" : `${c.percentual}%`}</TableCell>
                  <TableCell className="px-4 py-3 font-mono tabular-nums text-gray-700">{formatarMoeda(c.valor, c.moeda)}</TableCell>
                  <TableCell className="px-4 py-3"><SeloComissao status={c.status} /></TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
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
  onDecidir: (id: string, aprovar: boolean, motivo?: string) => void;
  isPending: boolean;
}) {
  const [aberta, setAberta] = useState<{ id: string; aprovar: boolean } | null>(null);
  const [motivo, setMotivo] = useState("");
  const impactoMensal = somarPorMoeda(aprovacoes.map((a) => ({ moeda: a.moeda, valor: a.impactoMensal })));
  const impactoAnual = impactoMensal.map((v) => ({ moeda: v.moeda, valor: v.valor * 12 }));
  function pedir(a: AprovacaoRow, aprovar: boolean) {
    if (aprovar && a.origem !== "PREPARACAO_MATRICULA") {
      onDecidir(a.id, true);
      return;
    }
    setAberta({ id: a.id, aprovar });
    setMotivo("");
  }
  return (
    <div>
      <div className="mb-3 flex flex-wrap gap-4 text-sm text-gray-600">
        <span className="font-mono tabular-nums">Pendentes: <strong>{aprovacoes.length}</strong></span>
        <span className="font-mono tabular-nums">Impacto mensal: <strong>{formatarValores(impactoMensal)}</strong></span>
        <span className="font-mono tabular-nums">Impacto anual: <strong>{formatarValores(impactoAnual)}</strong></span>
      </div>
      {aprovacoes.length === 0 ? (
        <EstadoVazio bloco>Nenhum pedido pendente.</EstadoVazio>
      ) : (
        <ul className="flex flex-col gap-2">
          {aprovacoes.map((a) => (
            <li key={a.id} className="rounded-lg border border-gray-200 bg-surface p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex min-w-0 items-start gap-3 text-sm">
                  <Avatar nome={a.alunoNome} tamanho={40} />
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="font-medium text-gray-800">
                        {a.alunoNome} — {a.origem === "PREPARACAO_MATRICULA" ? "Exceção de preço" : TIPO_APROVACAO_LABEL[a.tipo]}
                      </div>
                      <BadgeEstado tom="aprovacao" ponto>Pendente</BadgeEstado>
                    </div>
                    <div className="font-mono tabular-nums text-xs text-gray-600">{a.matriculaId ?? "—"}</div>
                    {a.origem === "PREPARACAO_MATRICULA" && a.matriculaId && (
                      <div className="mt-1">
                        <Link href={`/matriculas/${a.matriculaId}/preparacao`} className="text-brand-700 underline">Ver preparação</Link>
                      </div>
                    )}
                    <div className="font-mono tabular-nums text-gray-600">
                      {formatarMoeda(a.valorDe, a.moeda)} → {formatarMoeda(a.valorPara, a.moeda)}{" "}
                      <span className="text-gray-500">(desconto {formatarMoeda(a.descontoValor, a.moeda)})</span>
                    </div>
                    <LinhaCampo
                      icone={<IconUser size={18} />}
                      valor={<>{a.vigencia ? `${VIGENCIA_LABEL[a.vigencia]} · ` : ""}solicitante: {a.solicitante}{a.motivo ? ` · ${a.motivo}` : ""}</>}
                      rotulo="Solicitação"
                    />
                  </div>
                </div>
                <div className="flex shrink-0 gap-2">
                  {a.podeAprovarDireto !== false && (
                    <button
                      type="button"
                      onClick={() => pedir(a, true)}
                      disabled={isPending}
                      className={botaoClasses({ tamanho: "sm" })}
                    >
                      Aprovar
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => pedir(a, false)}
                    disabled={isPending}
                    className={botaoClasses({ variante: "perigo", tamanho: "sm" })}
                  >
                    Rejeitar
                  </button>
                </div>
              </div>
              {aberta?.id === a.id && (
                <div className="mt-3 grid gap-2">
                  <label className="grid gap-1 text-sm text-gray-700">
                    <span>{aberta.aprovar ? "Motivo da aprovação" : "Motivo da rejeição"}</span>
                    <CampoTexto className={CONTROLE_CAMPO} minLength={5} maxLength={2000} rows={2} value={motivo} onChange={(e) => setMotivo(e.target.value)} />
                  </label>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      disabled={isPending || motivo.trim().length < 5}
                      className={botaoClasses({ tamanho: "sm" })}
                      onClick={() => { onDecidir(a.id, aberta.aprovar, motivo.trim()); setAberta(null); }}
                    >Confirmar</button>
                    <button type="button" className={botaoClasses({ variante: "secundario", tamanho: "sm" })} disabled={isPending} onClick={() => setAberta(null)}>Cancelar</button>
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ValoresEmpilhados({ valores }: { valores: ValorMoeda[] }) {
  if (valores.length === 0) return <div className="font-mono text-2xl font-medium tabular-nums text-gray-300">—</div>;
  return (
    <div className="flex flex-col leading-tight">
      {valores.map((v) => (
        <span key={v.moeda} className="font-mono text-xl font-medium tabular-nums text-gray-800">{formatarMoeda(v.valor, v.moeda)}</span>
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
        <div className="w-28">
          <Select value={moedaCons} onValueChange={onMoeda}>
            <SelectTrigger aria-labelledby="financeiro-consolidar-rotulo" className={CONTROLE_CAMPO}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {opcoes.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <span className="text-xs text-gray-400">câmbio de referência · só leitura</span>
      </div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {cards.map(([t, valores]) => {
          const c = consolidar(valores, moedaCons, taxas);
          return (
            <div key={t} className="rounded-lg border border-gray-200 bg-surface p-4">
              <ValoresEmpilhados valores={valores} />
              {valores.length > 0 && (
                <div className="mt-0.5 font-mono text-xs tabular-nums text-gray-500">
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
      <p className="mt-4 text-sm text-gray-500">Novas matrículas no mês: <strong className="font-mono tabular-nums">{kpis.novasMatriculas}</strong></p>
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
        <Table className="w-full text-sm">
          <TableHeader className={CABECALHO_TABELA}>
            <TableRow>
              <TableHead className="px-4 py-2 font-medium">Moeda</TableHead>
              <TableHead className="px-4 py-2 font-medium">1 US$ =</TableHead>
              <TableHead className="px-4 py-2 font-medium">Atualizado</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody className="divide-y divide-gray-100">
            <TableRow>
              <TableCell className="px-4 py-2 font-medium text-gray-700">USD <span className="text-xs text-gray-400">(pivô)</span></TableCell>
              <TableCell className="px-4 py-2 font-mono tabular-nums text-gray-500">1</TableCell>
              <TableCell className="px-4 py-2 text-xs text-gray-400">fixo</TableCell>
            </TableRow>
            {editaveis.map((c) => (
              <TableRow key={c.moeda}>
                <TableCell className="px-4 py-2 font-medium text-gray-700">{c.moeda}</TableCell>
                <TableCell className="px-4 py-2">
                  <div className="w-32">
                    <input
                      type="number"
                      step="0.0001"
                      min="0"
                      aria-label={`Cotação: 1 US$ em ${c.moeda}`}
                      value={vals[c.moeda] ?? ""}
                      onChange={(e) => setVals((v) => ({ ...v, [c.moeda]: e.target.value }))}
                      placeholder="ex.: 512"
                      className={CONTROLE_CAMPO}
                    />
                  </div>
                </TableCell>
                <TableCell className="px-4 py-2 font-mono text-xs tabular-nums text-gray-400">
                  {c.vigenteEm ? (() => { const exibicao = formatarInstanteExibicao(c.vigenteEm, preferenciaFusoExibicao, "UTC"); return `${exibicao.texto} (horário exibido em ${exibicao.fuso}; origem UTC)`; })() : "sem cotação"}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
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
            <Table className="w-full text-sm">
              <TableHeader className={CABECALHO_TABELA}>
                <TableRow>
                  <TableHead className="px-4 py-2 font-medium">Moeda</TableHead>
                  <TableHead className="px-4 py-2 font-medium">Total concedido</TableHead>
                  <TableHead className="px-4 py-2 font-medium">Ajustes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody className="divide-y divide-gray-100">
                {descontoPorMoeda.map((d) => (
                  <TableRow key={d.moeda} className={LINHA_TABELA}>
                    <TableCell className="px-4 py-2 font-medium text-gray-700">{d.moeda}</TableCell>
                    <TableCell className="px-4 py-2 font-mono tabular-nums text-gray-700">{formatarMoeda(d.total, d.moeda)}</TableCell>
                    <TableCell className="px-4 py-2 font-mono tabular-nums text-gray-500">{d.qtd}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-2 text-sm font-medium text-gray-700">Comissão por vendedor</h2>
        {comissoesPorVendedor.length === 0 ? (
          <EstadoVazio>Sem comissões.</EstadoVazio>
        ) : (
          <div className="mb-6 overflow-x-auto rounded-lg border border-gray-200">
            <Table className="w-full min-w-[640px] text-sm">
              <TableHeader className={CABECALHO_TABELA}>
                <TableRow>
                  <TableHead className="px-4 py-2 font-medium">Vendedor</TableHead>
                  <TableHead className="px-4 py-2 font-medium">Moeda</TableHead>
                  <TableHead className="px-4 py-2 font-medium">Status</TableHead>
                  <TableHead className="px-4 py-2 font-medium">Total</TableHead>
                  <TableHead className="px-4 py-2 font-medium">Qtd</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody className="divide-y divide-gray-100">
                {comissoesPorVendedor.map((c, i) => (
                  <TableRow key={i} className={LINHA_TABELA}>
                    <TableCell className="px-4 py-2 font-medium text-gray-700"><Pessoa nome={c.vendedor} /></TableCell>
                    <TableCell className="px-4 py-2 text-gray-700">{c.moeda}</TableCell>
                    <TableCell className="px-4 py-2"><SeloComissao status={c.status} /></TableCell>
                    <TableCell className="px-4 py-2 font-mono tabular-nums text-gray-700">{formatarMoeda(c.total, c.moeda)}</TableCell>
                    <TableCell className="px-4 py-2 font-mono tabular-nums text-gray-500">{c.qtd}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        <h2 className="mb-2 text-sm font-medium text-gray-700">Desconto por vendedor</h2>
        {descontoPorVendedor.length === 0 ? (
          <EstadoVazio>Sem descontos por vendedor.</EstadoVazio>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-gray-200">
            <Table className="w-full text-sm">
              <TableHeader className={CABECALHO_TABELA}>
                <TableRow>
                  <TableHead className="px-4 py-2 font-medium">Vendedor</TableHead>
                  <TableHead className="px-4 py-2 font-medium">Moeda</TableHead>
                  <TableHead className="px-4 py-2 font-medium">Total concedido</TableHead>
                  <TableHead className="px-4 py-2 font-medium">Ajustes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody className="divide-y divide-gray-100">
                {descontoPorVendedor.map((d, i) => (
                  <TableRow key={`${d.vendedor}-${d.moeda}-${i}`} className={LINHA_TABELA}>
                    <TableCell className="px-4 py-2 text-gray-700"><Pessoa nome={d.vendedor} /></TableCell>
                    <TableCell className="px-4 py-2 text-gray-600">{d.moeda}</TableCell>
                    <TableCell className="px-4 py-2 font-mono tabular-nums text-gray-700">{formatarMoeda(d.total, d.moeda)}</TableCell>
                    <TableCell className="px-4 py-2 font-mono tabular-nums text-gray-500">{d.qtd}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-2 text-sm font-medium text-gray-700">Comissão por moeda e status</h2>
        {comissoesPorStatus.length === 0 ? (
          <EstadoVazio>Sem comissões.</EstadoVazio>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-gray-200">
            <Table className="w-full text-sm">
              <TableHeader className={CABECALHO_TABELA}>
                <TableRow>
                  <TableHead className="px-4 py-2 font-medium">Moeda</TableHead>
                  <TableHead className="px-4 py-2 font-medium">Status</TableHead>
                  <TableHead className="px-4 py-2 font-medium">Total</TableHead>
                  <TableHead className="px-4 py-2 font-medium">Qtde</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody className="divide-y divide-gray-100">
                {comissoesPorStatus.map((c, i) => (
                  <TableRow key={`${c.moeda}-${c.status}-${i}`} className={LINHA_TABELA}>
                    <TableCell className="px-4 py-2 font-medium text-gray-700">{c.moeda}</TableCell>
                    <TableCell className="px-4 py-2"><SeloComissao status={c.status} /></TableCell>
                    <TableCell className="px-4 py-2 font-mono tabular-nums text-gray-700">{formatarMoeda(c.total, c.moeda)}</TableCell>
                    <TableCell className="px-4 py-2 font-mono tabular-nums text-gray-500">{c.qtd}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </section>
    </div>
  );
}

