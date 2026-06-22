"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormaPagamento, TipoCobranca, StatusComissao, TipoAprovacao, Vigencia } from "@prisma/client";
import {
  TIPO_COBRANCA_LABEL,
  FORMA_PAGAMENTO_LABEL,
  STATUS_COMISSAO_LABEL,
} from "@/lib/labels";
import type { ModeloWhatsapp } from "@/server/financeiro/schema";
import { registrarPagamento, registrarCobrancaWhatsApp, fecharMesComissoes } from "@/server/financeiro/acoes";
import { decidirAprovacao } from "@/server/ajustes/acoes";

export interface CobrancaRow {
  id: string;
  codigo: string | null;
  tipo: TipoCobranca;
  valorNegociado: number;
  moeda: string;
  vencimento: string;
  atrasado: boolean;
  tentativasCobranca: number;
  ultimaCobrancaEm: string | null;
  aluno: { id: string; nome: string; telefone: string | null };
  turma: string | null;
}
export interface ComissaoRow {
  id: string;
  vendedor: string;
  valor: number;
  moeda: string;
  percentual: number;
  status: StatusComissao;
}
export interface Kpis {
  recebidoMes: number;
  emAtraso: number;
  aReceber: number;
  comissoesAPagar: number;
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
const VIGENCIA_LABEL: Record<Vigencia, string> = {
  ESTA_COBRANCA: "🟢 Esta cobrança",
  PROXIMOS_MESES: "🟡 Próximos meses",
  CONTRATO_INTEIRO: "🔴 Contrato inteiro",
};

const btnPri = "rounded-md bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60";
const btnSec = "rounded-md border border-gray-300 px-2.5 py-1 text-xs text-gray-600 hover:bg-gray-50";
const inputCls = "w-full rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-brand-500";

function diasAtraso(venc: string): number {
  return Math.floor((Date.now() - new Date(venc).getTime()) / 86400000);
}

function modeloSugerido(venc: string): ModeloWhatsapp {
  const d = diasAtraso(venc);
  if (d <= 5) return "amigavel";
  if (d <= 15) return "vencida";
  return "firme";
}

function mensagem(modelo: ModeloWhatsapp, nome: string, valor: string): string {
  const m: Record<ModeloWhatsapp, string> = {
    amigavel: `Olá ${nome}! 😊 Passando para lembrar da sua mensalidade de ${valor}. Qualquer dúvida, estou à disposição!`,
    vencida: `Olá ${nome}, notamos que a cobrança de ${valor} está vencida. Consegue regularizar?`,
    firme: `Olá ${nome}, sua cobrança de ${valor} está em atraso. Precisamos regularizar para manter sua matrícula ativa.`,
    dados: `Olá ${nome}! Seguem os dados para pagamento de ${valor}. Pode me confirmar quando efetuar?`,
    promessa: `Olá ${nome}, podemos combinar uma data para o pagamento de ${valor}?`,
  };
  return m[modelo];
}

type Aba = "cobrancas" | "inadimplencia" | "comissoes" | "geral" | "aprovacoes";

export function FinanceiroPainel({
  cobrancas,
  comissoes,
  kpis,
  aprovacoes,
  podeAprovar,
}: {
  cobrancas: CobrancaRow[];
  comissoes: ComissaoRow[];
  kpis: Kpis;
  aprovacoes: AprovacaoRow[];
  podeAprovar: boolean;
}) {
  const router = useRouter();
  const [aba, setAba] = useState<Aba>("cobrancas");
  const [erro, setErro] = useState<string | null>(null);
  const [pagar, setPagar] = useState<CobrancaRow | null>(null);
  const [whats, setWhats] = useState<CobrancaRow | null>(null);

  async function run(p: Promise<{ ok: boolean; erro?: string }>) {
    setErro(null);
    const r = await p;
    if (!r.ok) setErro(r.erro ?? "Erro.");
    else router.refresh();
  }

  const atrasadas = useMemo(() => cobrancas.filter((c) => c.atrasado), [cobrancas]);
  const ordenadas = useMemo(
    () => [...cobrancas].sort((a, b) => Number(b.atrasado) - Number(a.atrasado) || a.vencimento.localeCompare(b.vencimento)),
    [cobrancas],
  );

  const abas: [Aba, string][] = [
    ["cobrancas", "Cobranças"],
    ["inadimplencia", "Inadimplência"],
    ["comissoes", "Comissões"],
    ["geral", "Visão geral"],
    ...(podeAprovar ? ([["aprovacoes", `Aprovações${aprovacoes.length ? ` (${aprovacoes.length})` : ""}`]] as [Aba, string][]) : []),
  ];

  return (
    <div>
      <h1 className="mb-3 text-2xl font-medium">Financeiro</h1>
      <nav className="mb-5 flex flex-wrap gap-1">
        {abas.map(([a, label]) => (
          <button
            key={a}
            onClick={() => setAba(a)}
            className={"rounded-md px-3 py-1.5 text-sm " + (aba === a ? "bg-brand-600 font-medium text-white" : "text-gray-600 hover:bg-gray-100")}
          >
            {label}
          </button>
        ))}
      </nav>

      {erro && <p className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{erro}</p>}

      {aba === "inadimplencia" && (
        <CobrancasTabela linhas={atrasadas} onPagar={setPagar} onWhats={setWhats} />
      )}

      {aba === "cobrancas" && (
        <CobrancasAgrupadas linhas={ordenadas} onPagar={setPagar} onWhats={setWhats} />
      )}

      {aba === "comissoes" && (
        <Comissoes comissoes={comissoes} onFechar={() => run(fecharMesComissoes())} />
      )}

      {aba === "geral" && <VisaoGeral kpis={kpis} />}

      {aba === "aprovacoes" && <Aprovacoes aprovacoes={aprovacoes} onDecidir={(id, ok) => run(decidirAprovacao(id, { aprovar: ok }))} />}

      {pagar && (
        <PagamentoModal cobranca={pagar} onClose={() => setPagar(null)} onDone={() => { setPagar(null); router.refresh(); }} onErro={setErro} />
      )}
      {whats && <WhatsappModal cobranca={whats} onClose={() => setWhats(null)} onErro={setErro} onRefresh={() => router.refresh()} />}
    </div>
  );
}

function CobrancasAgrupadas({
  linhas,
  onPagar,
  onWhats,
}: {
  linhas: CobrancaRow[];
  onPagar: (c: CobrancaRow) => void;
  onWhats: (c: CobrancaRow) => void;
}) {
  const agora = new Date();
  const fimHoje = new Date(); fimHoje.setHours(23, 59, 59, 999);
  const em7 = new Date(agora.getTime() + 7 * 86400000);
  const em30 = new Date(agora.getTime() + 30 * 86400000);

  const atrasados = linhas.filter((c) => c.atrasado);
  const hoje = linhas.filter((c) => !c.atrasado && new Date(c.vencimento) <= fimHoje);
  const sete = linhas.filter((c) => !c.atrasado && new Date(c.vencimento) > fimHoje && new Date(c.vencimento) <= em7);
  const trinta = linhas.filter((c) => !c.atrasado && new Date(c.vencimento) > em7 && new Date(c.vencimento) <= em30);
  const depois = linhas.filter((c) => !c.atrasado && new Date(c.vencimento) > em30);

  const grupos: [string, CobrancaRow[]][] = [
    ["Atrasados", atrasados],
    ["Vence hoje", hoje],
    ["Próximos 7 dias", sete],
    ["Próximos 30 dias", trinta],
    ["Depois", depois],
  ];

  return (
    <div className="flex flex-col gap-5">
      {grupos.map(([titulo, itens]) =>
        itens.length === 0 ? null : (
          <div key={titulo}>
            <h2 className="mb-2 text-sm font-medium text-gray-700">
              {titulo} <span className="text-gray-400">({itens.length})</span>
            </h2>
            <CobrancasTabela linhas={itens} onPagar={onPagar} onWhats={onWhats} />
          </div>
        ),
      )}
      {linhas.length === 0 && (
        <div className="rounded-lg border border-dashed border-gray-300 p-10 text-center text-sm text-gray-400">
          Nenhuma cobrança em aberto.
        </div>
      )}
    </div>
  );
}

function CobrancasTabela({
  linhas,
  onPagar,
  onWhats,
}: {
  linhas: CobrancaRow[];
  onPagar: (c: CobrancaRow) => void;
  onWhats: (c: CobrancaRow) => void;
}) {
  return (
    <div className="overflow-hidden rounded-lg border border-gray-200">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 text-left text-xs text-gray-500">
          <tr>
            <th className="px-4 py-2 font-medium">Aluno / contexto</th>
            <th className="px-4 py-2 font-medium">Cobrança</th>
            <th className="px-4 py-2 font-medium">Vencimento</th>
            <th className="px-4 py-2 font-medium">Valor</th>
            <th className="px-4 py-2 font-medium text-right">Ações</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {linhas.length === 0 ? (
            <tr><td colSpan={5} className="px-4 py-6 text-center text-sm text-gray-400">Nenhuma cobrança.</td></tr>
          ) : (
            linhas.map((c) => (
              <tr key={c.id} className="hover:bg-gray-50">
                <td className="px-4 py-3">
                  <Link href={`/alunos/${c.aluno.id}`} className="font-medium text-brand-700 hover:underline">
                    {c.aluno.nome}
                  </Link>
                  <div className="text-xs text-gray-400">{c.turma ?? "sem turma"} · {c.codigo}</div>
                  {c.tentativasCobranca > 0 && (
                    <div className="text-xs text-amber-600">
                      {c.tentativasCobranca} cobrança(s)
                      {c.ultimaCobrancaEm ? ` · última há ${diasAtraso(c.ultimaCobrancaEm)}d` : ""}
                    </div>
                  )}
                </td>
                <td className="px-4 py-3 text-gray-600">{TIPO_COBRANCA_LABEL[c.tipo]}</td>
                <td className="px-4 py-3">
                  <span className={c.atrasado ? "text-red-600" : "text-gray-600"}>
                    {new Date(c.vencimento).toLocaleDateString("pt-BR")}
                  </span>
                  {c.atrasado && <span className="ml-1 text-xs text-red-500">({diasAtraso(c.vencimento)}d)</span>}
                </td>
                <td className="px-4 py-3 text-gray-700">{c.moeda} {c.valorNegociado.toLocaleString("pt-BR")}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-end gap-2">
                    {c.aluno.telefone && (
                      <button className={btnSec} onClick={() => onWhats(c)}>WhatsApp</button>
                    )}
                    <button className={btnSec} onClick={() => onPagar(c)}>Registrar pagamento</button>
                  </div>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

function Comissoes({ comissoes, onFechar }: { comissoes: ComissaoRow[]; onFechar: () => void }) {
  const aPagar = comissoes.filter((c) => c.status === StatusComissao.APROVADA).reduce((s, c) => s + c.valor, 0);
  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm text-gray-500">A pagar (aprovadas): <strong>{aPagar.toLocaleString("pt-BR")}</strong></p>
        <button className={btnPri} onClick={onFechar}>Fechar mês e marcar pagas</button>
      </div>
      <div className="overflow-hidden rounded-lg border border-gray-200">
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
              <tr><td colSpan={4} className="px-4 py-6 text-center text-sm text-gray-400">Sem comissões.</td></tr>
            ) : (
              comissoes.map((c) => (
                <tr key={c.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-gray-800">{c.vendedor}</td>
                  <td className="px-4 py-3 text-gray-600">{c.percentual}%</td>
                  <td className="px-4 py-3 text-gray-700">{c.moeda} {c.valor.toLocaleString("pt-BR")}</td>
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

function Aprovacoes({
  aprovacoes,
  onDecidir,
}: {
  aprovacoes: AprovacaoRow[];
  onDecidir: (id: string, aprovar: boolean) => void;
}) {
  const impactoMensal = aprovacoes.reduce((s, a) => s + a.impactoMensal, 0);
  return (
    <div>
      <div className="mb-3 flex flex-wrap gap-4 text-sm text-gray-600">
        <span>Pendentes: <strong>{aprovacoes.length}</strong></span>
        <span>Impacto mensal: <strong>{impactoMensal.toLocaleString("pt-BR")}</strong></span>
        <span>Impacto anual: <strong>{(impactoMensal * 12).toLocaleString("pt-BR")}</strong></span>
      </div>
      {aprovacoes.length === 0 ? (
        <div className="rounded-lg border border-dashed border-gray-300 p-10 text-center text-sm text-gray-400">
          Nenhum pedido pendente.
        </div>
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
                    {a.moeda} {a.valorDe.toLocaleString("pt-BR")} → {a.valorPara.toLocaleString("pt-BR")}{" "}
                    <span className="text-gray-500">(desconto {a.moeda} {a.descontoValor.toLocaleString("pt-BR")})</span>
                  </div>
                  <div className="text-xs text-gray-500">
                    {a.vigencia ? VIGENCIA_LABEL[a.vigencia] + " · " : ""}solicitante: {a.solicitante}
                    {a.motivo ? ` · ${a.motivo}` : ""}
                  </div>
                </div>
                <div className="flex shrink-0 gap-2">
                  <button
                    onClick={() => onDecidir(a.id, true)}
                    className="rounded-md bg-success px-3 py-1 text-xs font-medium text-white hover:opacity-90"
                  >
                    Aprovar
                  </button>
                  <button
                    onClick={() => onDecidir(a.id, false)}
                    className="rounded-md border border-gray-300 px-3 py-1 text-xs text-gray-600 hover:bg-gray-50"
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

function VisaoGeral({ kpis }: { kpis: Kpis }) {
  const cards = [
    ["Recebido no mês", kpis.recebidoMes],
    ["A receber", kpis.aReceber],
    ["Em atraso", kpis.emAtraso],
    ["Comissões a pagar", kpis.comissoesAPagar],
  ] as const;
  return (
    <div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {cards.map(([t, v]) => (
          <div key={t} className="rounded-lg border border-gray-200 bg-surface p-4">
            <div className="text-2xl font-semibold text-gray-800">{v.toLocaleString("pt-BR")}</div>
            <div className="text-xs text-gray-500">{t}</div>
          </div>
        ))}
      </div>
      <p className="mt-4 text-sm text-gray-500">Novas matrículas no mês: <strong>{kpis.novasMatriculas}</strong></p>
      <p className="mt-1 text-xs text-gray-400">Consolidação multi-moeda em USD nos KPIs entra na Fase 2.</p>
    </div>
  );
}

function PagamentoModal({
  cobranca,
  onClose,
  onDone,
  onErro,
}: {
  cobranca: CobrancaRow;
  onClose: () => void;
  onDone: () => void;
  onErro: (e: string) => void;
}) {
  const [valor, setValor] = useState(String(cobranca.valorNegociado));
  const [forma, setForma] = useState<FormaPagamento>(FormaPagamento.TRANSFERENCIA);
  const [data, setData] = useState("");
  const [comentario, setComentario] = useState("");
  const [salvando, setSalvando] = useState(false);

  const diff = cobranca.valorNegociado - Number(valor || 0);

  async function salvar() {
    setSalvando(true);
    const r = await registrarPagamento(cobranca.id, {
      valorRecebido: valor === "" ? 0 : Number(valor),
      forma,
      dataPagamento: data,
      comentario,
    });
    setSalvando(false);
    if (!r.ok) onErro(r.erro);
    else onDone();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
      <div className="w-full max-w-md rounded-lg bg-surface p-5">
        <h3 className="mb-1 text-sm font-medium">Registrar pagamento — {cobranca.aluno.nome}</h3>
        <p className="mb-4 text-xs text-gray-500">Esperado: {cobranca.moeda} {cobranca.valorNegociado.toLocaleString("pt-BR")}</p>
        <label className="mb-1 block text-xs text-gray-600">Valor recebido</label>
        <input type="number" step="0.01" className={inputCls + " mb-1"} value={valor} onChange={(e) => setValor(e.target.value)} />
        {diff > 0 && <p className="mb-2 text-xs text-amber-600">Pagamento parcial — saldo de {cobranca.moeda} {diff.toLocaleString("pt-BR")}.</p>}
        <label className="mb-1 mt-2 block text-xs text-gray-600">Forma</label>
        <select className={inputCls + " mb-2"} value={forma} onChange={(e) => setForma(e.target.value as FormaPagamento)}>
          {Object.values(FormaPagamento).map((f) => (
            <option key={f} value={f}>{FORMA_PAGAMENTO_LABEL[f]}</option>
          ))}
        </select>
        <label className="mb-1 block text-xs text-gray-600">Data (opcional)</label>
        <input type="date" className={inputCls + " mb-2"} value={data} onChange={(e) => setData(e.target.value)} />
        <label className="mb-1 block text-xs text-gray-600">Comentário</label>
        <input className={inputCls + " mb-4"} value={comentario} onChange={(e) => setComentario(e.target.value)} />
        <div className="flex gap-2">
          <button className={btnPri} disabled={salvando} onClick={salvar}>{salvando ? "Salvando…" : "Registrar pagamento"}</button>
          <button className="rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50" onClick={onClose}>Cancelar</button>
        </div>
      </div>
    </div>
  );
}

function WhatsappModal({
  cobranca,
  onClose,
  onErro,
  onRefresh,
}: {
  cobranca: CobrancaRow;
  onClose: () => void;
  onErro: (e: string) => void;
  onRefresh: () => void;
}) {
  const [modelo, setModelo] = useState<ModeloWhatsapp>(modeloSugerido(cobranca.vencimento));
  const valorTxt = `${cobranca.moeda} ${cobranca.valorNegociado.toLocaleString("pt-BR")}`;
  const [texto, setTexto] = useState(mensagem(modelo, cobranca.aluno.nome, valorTxt));

  function trocarModelo(m: ModeloWhatsapp) {
    setModelo(m);
    setTexto(mensagem(m, cobranca.aluno.nome, valorTxt));
  }

  async function abrir() {
    const fone = (cobranca.aluno.telefone ?? "").replace(/\D/g, "");
    const url = `https://wa.me/${fone}?text=${encodeURIComponent(texto)}`;
    window.open(url, "_blank");
    const r = await registrarCobrancaWhatsApp(cobranca.id, modelo);
    if (!r.ok) onErro(r.erro);
    else onRefresh();
  }

  const modelos: [ModeloWhatsapp, string][] = [
    ["amigavel", "Amigável"],
    ["vencida", "Vencida"],
    ["firme", "Firme"],
    ["dados", "Dados de pagamento"],
    ["promessa", "Promessa de pagamento"],
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
      <div className="w-full max-w-lg rounded-lg bg-surface p-5">
        <h3 className="mb-3 text-sm font-medium">Cobrar via WhatsApp — {cobranca.aluno.nome}</h3>
        <div className="mb-3 flex flex-wrap gap-1">
          {modelos.map(([m, label]) => (
            <button
              key={m}
              onClick={() => trocarModelo(m)}
              className={"rounded-md px-2 py-1 text-xs " + (modelo === m ? "bg-brand-600 text-white" : "bg-gray-100 text-gray-600")}
            >
              {label}
            </button>
          ))}
        </div>
        <textarea className={inputCls + " mb-4 h-28"} value={texto} onChange={(e) => setTexto(e.target.value)} />
        <div className="flex gap-2">
          <button className={btnPri} onClick={abrir}>Abrir no WhatsApp</button>
          <button className="rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50" onClick={() => navigator.clipboard?.writeText(texto)}>Copiar</button>
          <button className="rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50" onClick={onClose}>Fechar</button>
        </div>
        <p className="mt-2 text-xs text-gray-400">wa.me manual (sem Cloud API). "Abrir" registra a tentativa.</p>
      </div>
    </div>
  );
}
