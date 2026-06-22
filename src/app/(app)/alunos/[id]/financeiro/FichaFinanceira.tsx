"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormaPagamento, TipoAjuste, Vigencia, TipoCobranca, StatusCobranca, StatusComissao } from "@prisma/client";
import {
  TIPO_COBRANCA_LABEL,
  STATUS_COBRANCA_LABEL,
  STATUS_COMISSAO_LABEL,
} from "@/lib/labels";
import { ajustarCobranca } from "@/server/ajustes/acoes";
import { PagamentoModal } from "@/components/PagamentoModal";

const inputCls = "w-full rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-brand-500";
const btnPri = "rounded-md bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60";
const btnSec = "rounded-md border border-gray-300 px-2.5 py-1 text-xs text-gray-600 hover:bg-gray-50";

const TIPO_AJUSTE_LABEL: Record<TipoAjuste, string> = {
  DESCONTO: "Desconto",
  BOLSA: "Bolsa",
  ALTERACAO_VALOR: "Alteração de valor",
  PERDAO: "Perdão de dívida",
  RENEGOCIACAO: "Renegociação",
};
const VIGENCIA_INFO: Record<Vigencia, { label: string; cls: string }> = {
  ESTA_COBRANCA: { label: "🟢 Apenas esta cobrança", cls: "text-green-700" },
  PROXIMOS_MESES: { label: "🟡 Próximos meses", cls: "text-amber-700" },
  CONTRATO_INTEIRO: { label: "🔴 Contrato inteiro", cls: "text-red-700" },
};

export interface FichaFinanceiraDados {
  aluno: { id: string; nome: string; codigo: string | null; pais: string };
  responsavelFinanceiro: string;
  situacaoAtrasado: boolean;
  moeda: string;
  tiles: {
    proximoVenc: { valor: number; data: string } | null;
    ultimoPago: { valor: number; data: string; forma: string | null } | null;
    emAberto: number;
    emAtraso: number;
  };
  contrato: { produto: string; moeda: string; status: string }[];
  cobrancas: {
    id: string;
    tipo: TipoCobranca;
    status: StatusCobranca;
    valorNegociado: number;
    moeda: string;
    vencimento: string;
    pagoEm: string | null;
    forma: FormaPagamento | null;
  }[];
  ajustes: {
    id: string;
    tipo: TipoAjuste;
    valorDe: number;
    valorPara: number;
    descontoValor: number;
    motivo: string;
    autor: string;
    criadoEm: string;
    vigencia: Vigencia | null;
  }[];
  comissoes: { id: string; vendedor: string; valor: number; moeda: string; percentual: number; status: StatusComissao }[];
  permissoes: { registrarPagamento: boolean; renegociar: boolean; perdao: boolean };
}

export function FichaFinanceira({ dados }: { dados: FichaFinanceiraDados }) {
  const router = useRouter();
  const [erro, setErro] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [pagar, setPagar] = useState<FichaFinanceiraDados["cobrancas"][number] | null>(null);
  const [reneg, setReneg] = useState<FichaFinanceiraDados["cobrancas"][number] | null>(null);

  const t = dados.tiles;

  return (
    <div className="flex flex-col gap-6">
      {erro && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{erro}</p>}
      {msg && <p className="rounded-md bg-blue-50 px-3 py-2 text-sm text-blue-700">{msg}</p>}

      <header>
        <Link href={`/alunos/${dados.aluno.id}`} className="text-xs text-brand-700 hover:underline">← Ficha do aluno</Link>
        <div className="mt-1 flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-medium">{dados.aluno.nome}</h1>
          <span className={dados.situacaoAtrasado ? "rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700" : "rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700"}>
            {dados.situacaoAtrasado ? "Em atraso" : "Em dia"}
          </span>
        </div>
        <p className="mt-1 text-sm text-gray-500">
          {dados.aluno.codigo} · {dados.aluno.pais} · Responsável financeiro: {dados.responsavelFinanceiro}
        </p>
      </header>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Tile titulo="Próximo vencimento" valor={t.proximoVenc ? `${dados.moeda} ${t.proximoVenc.valor.toLocaleString("pt-BR")}` : "—"} sub={t.proximoVenc ? new Date(t.proximoVenc.data).toLocaleDateString("pt-BR") : ""} />
        <Tile titulo="Último pagamento" valor={t.ultimoPago ? `${dados.moeda} ${t.ultimoPago.valor.toLocaleString("pt-BR")}` : "—"} sub={t.ultimoPago ? new Date(t.ultimoPago.data).toLocaleDateString("pt-BR") : ""} />
        <Tile titulo="Em aberto" valor={`${dados.moeda} ${t.emAberto.toLocaleString("pt-BR")}`} />
        <Tile titulo="Em atraso" valor={`${dados.moeda} ${t.emAtraso.toLocaleString("pt-BR")}`} cls={t.emAtraso > 0 ? "text-red-600" : ""} />
      </div>

      {/* Cobranças */}
      <section className="overflow-hidden rounded-lg border border-gray-200">
        <div className="border-b border-gray-100 bg-gray-50 px-4 py-2 text-sm font-medium">Cobranças</div>
        <table className="w-full text-sm">
          <thead className="text-left text-xs text-gray-500">
            <tr>
              <th className="px-4 py-2 font-medium">Tipo</th>
              <th className="px-4 py-2 font-medium">Vencimento</th>
              <th className="px-4 py-2 font-medium">Valor</th>
              <th className="px-4 py-2 font-medium">Status</th>
              <th className="px-4 py-2 font-medium text-right">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {dados.cobrancas.map((c) => (
              <tr key={c.id} className="hover:bg-gray-50">
                <td className="px-4 py-2">{TIPO_COBRANCA_LABEL[c.tipo]}</td>
                <td className="px-4 py-2 text-gray-600">{new Date(c.vencimento).toLocaleDateString("pt-BR")}</td>
                <td className="px-4 py-2">{c.moeda} {c.valorNegociado.toLocaleString("pt-BR")}</td>
                <td className="px-4 py-2 text-gray-600">{STATUS_COBRANCA_LABEL[c.status]}</td>
                <td className="px-4 py-2">
                  <div className="flex items-center justify-end gap-2">
                    {(c.status === StatusCobranca.PENDENTE || c.status === StatusCobranca.ATRASADO) && (
                      <>
                        {dados.permissoes.registrarPagamento && (
                          <button className={btnSec} onClick={() => setPagar(c)}>Registrar pagamento</button>
                        )}
                        {dados.permissoes.renegociar && (
                          <button className={btnSec} onClick={() => setReneg(c)}>Renegociar / ajustar</button>
                        )}
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {/* Histórico de negociação */}
      <section className="rounded-lg border border-gray-200 bg-surface p-4">
        <h2 className="mb-3 font-medium">Histórico de negociação</h2>
        {dados.ajustes.length === 0 ? (
          <p className="text-sm text-gray-400">Sem ajustes.</p>
        ) : (
          <ul className="flex flex-col gap-2 text-sm">
            {dados.ajustes.map((a) => (
              <li key={a.id} className="border-l-2 border-gray-200 pl-3">
                <div className="text-gray-800">
                  {TIPO_AJUSTE_LABEL[a.tipo]}: {dados.moeda} {a.valorDe.toLocaleString("pt-BR")} → {a.valorPara.toLocaleString("pt-BR")}
                  <span className="ml-2 text-gray-500">(desconto {dados.moeda} {a.descontoValor.toLocaleString("pt-BR")})</span>
                </div>
                <div className="text-xs text-gray-500">{a.motivo} · {a.autor} · {new Date(a.criadoEm).toLocaleDateString("pt-BR")}{a.vigencia ? ` · ${VIGENCIA_INFO[a.vigencia].label}` : ""}</div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Comissão */}
      <section className="rounded-lg border border-gray-200 bg-surface p-4">
        <h2 className="mb-3 font-medium">Comissão</h2>
        {dados.comissoes.length === 0 ? (
          <p className="text-sm text-gray-400">Sem comissão.</p>
        ) : (
          <ul className="text-sm text-gray-700">
            {dados.comissoes.map((c) => (
              <li key={c.id}>{c.vendedor} · {c.percentual}% · {c.moeda} {c.valor.toLocaleString("pt-BR")} · {STATUS_COMISSAO_LABEL[c.status]}</li>
            ))}
          </ul>
        )}
      </section>

      {pagar && (
        <PagamentoModal
          cobrancaId={pagar.id}
          alunoNome={dados.aluno.nome}
          moeda={dados.moeda}
          valorEsperado={pagar.valorNegociado}
          onClose={() => setPagar(null)}
          onDone={() => { setPagar(null); router.refresh(); }}
          onErro={setErro}
        />
      )}
      {reneg && (
        <RenegociarModal
          cobranca={reneg}
          moeda={dados.moeda}
          podePerdao={dados.permissoes.perdao}
          onClose={() => setReneg(null)}
          onDone={(aprovacao) => {
            setReneg(null);
            if (aprovacao) setMsg("Ajuste acima do limite — enviado para aprovação.");
            router.refresh();
          }}
          onErro={setErro}
        />
      )}
    </div>
  );
}

function Tile({ titulo, valor, sub, cls }: { titulo: string; valor: string; sub?: string; cls?: string }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-surface p-4">
      <div className={"text-lg font-semibold text-gray-800 " + (cls ?? "")}>{valor}</div>
      <div className="text-xs text-gray-500">{titulo}</div>
      {sub && <div className="text-xs text-gray-400">{sub}</div>}
    </div>
  );
}

function RenegociarModal({
  cobranca,
  moeda,
  podePerdao,
  onClose,
  onDone,
  onErro,
}: {
  cobranca: FichaFinanceiraDados["cobrancas"][number];
  moeda: string;
  podePerdao: boolean;
  onClose: () => void;
  onDone: (aprovacao: boolean) => void;
  onErro: (e: string) => void;
}) {
  const tipos = [TipoAjuste.DESCONTO, TipoAjuste.BOLSA, TipoAjuste.ALTERACAO_VALOR, TipoAjuste.RENEGOCIACAO, ...(podePerdao ? [TipoAjuste.PERDAO] : [])];
  const [tipo, setTipo] = useState<TipoAjuste>(TipoAjuste.DESCONTO);
  const [valorPara, setValor] = useState(String(cobranca.valorNegociado));
  const [vigencia, setVig] = useState<Vigencia>(Vigencia.ESTA_COBRANCA);
  const [novoVenc, setVenc] = useState("");
  const [motivo, setMotivo] = useState("");
  const [salvando, setSalvando] = useState(false);

  const desconto = cobranca.valorNegociado - Number(valorPara || 0);

  async function salvar() {
    setSalvando(true);
    const r = await ajustarCobranca({
      cobrancaId: cobranca.id,
      tipo,
      valorPara: tipo === TipoAjuste.PERDAO ? 0 : valorPara === "" ? 0 : Number(valorPara),
      vigencia,
      novoVencimento: novoVenc,
      motivo,
    });
    setSalvando(false);
    if (!r.ok) onErro(r.erro);
    else onDone(!!r.dado?.aprovacao);
  }

  return (
    <Modal titulo="Renegociar / ajustar" onClose={onClose}>
      <label className="mb-1 block text-xs text-gray-600">Tipo</label>
      <select className={inputCls + " mb-2"} value={tipo} onChange={(e) => setTipo(e.target.value as TipoAjuste)}>
        {tipos.map((t) => <option key={t} value={t}>{TIPO_AJUSTE_LABEL[t]}</option>)}
      </select>
      {tipo !== TipoAjuste.PERDAO && (
        <>
          <label className="mb-1 block text-xs text-gray-600">Novo valor (de {moeda} {cobranca.valorNegociado.toLocaleString("pt-BR")})</label>
          <input type="number" step="0.01" className={inputCls + " mb-1"} value={valorPara} onChange={(e) => setValor(e.target.value)} />
          {desconto !== 0 && <p className="mb-2 text-xs text-gray-600">Desconto concedido: <strong>{moeda} {desconto.toLocaleString("pt-BR")}</strong></p>}
        </>
      )}
      <label className="mb-1 block text-xs text-gray-600">Vigência</label>
      <select className={inputCls + " mb-1"} value={vigencia} onChange={(e) => setVig(e.target.value as Vigencia)}>
        {Object.values(Vigencia).map((v) => <option key={v} value={v}>{VIGENCIA_INFO[v].label}</option>)}
      </select>
      <p className={"mb-2 text-xs " + VIGENCIA_INFO[vigencia].cls}>{VIGENCIA_INFO[vigencia].label}</p>
      <label className="mb-1 block text-xs text-gray-600">Novo vencimento (opcional)</label>
      <input type="date" className={inputCls + " mb-2"} value={novoVenc} onChange={(e) => setVenc(e.target.value)} />
      <label className="mb-1 block text-xs text-gray-600">Motivo (obrigatório)</label>
      <input className={inputCls + " mb-3"} value={motivo} onChange={(e) => setMotivo(e.target.value)} />
      <p className="mb-3 text-xs text-gray-400">Acima do seu limite de desconto, o pedido vai para aprovação do Gerente Comercial / Admin.</p>
      <div className="flex gap-2">
        <button className={btnPri} disabled={salvando} onClick={salvar}>{salvando ? "Salvando…" : "Aplicar ajuste"}</button>
        <button className="rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50" onClick={onClose}>Cancelar</button>
      </div>
    </Modal>
  );
}

function Modal({ titulo, onClose, children }: { titulo: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-lg bg-surface p-5" onClick={(e) => e.stopPropagation()}>
        <h3 className="mb-3 text-sm font-medium">{titulo}</h3>
        {children}
      </div>
    </div>
  );
}
