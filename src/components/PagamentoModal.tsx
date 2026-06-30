"use client";

import { useState } from "react";
import { FormaPagamento } from "@prisma/client";
import { FORMA_PAGAMENTO_LABEL } from "@/lib/labels";
import { formatarMoeda } from "@/lib/dinheiro";
import { registrarPagamento } from "@/server/financeiro/acoes";
import { UploadArquivo } from "@/components/UploadArquivo";

const inputCls = "w-full rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-brand-500";
const btnPri = "rounded-md bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60";

// Formas em que o comprovante é essencial pro fluxo (doc 09 §Registrar pagamento:
// "Essencial pro fluxo de transferência — anexa a prova"). GreenPay também gera prova.
export const FORMAS_EXIGEM_COMPROVANTE: FormaPagamento[] = [
  FormaPagamento.TRANSFERENCIA,
  FormaPagamento.GREENPAY,
];

/**
 * Modal único de registrar pagamento (baixa manual), compartilhado entre o painel
 * financeiro geral e a ficha financeira do aluno. Sempre permite anexar comprovante
 * (PDF/JPG/PNG) e exige a prova quando a forma de pagamento for transferência/GreenPay.
 */
export function PagamentoModal({
  cobrancaId,
  alunoNome,
  moeda,
  valorEsperado,
  jaRecebido = 0,
  saldoRestante,
  onClose,
  onDone,
  onErro,
}: {
  cobrancaId: string;
  alunoNome?: string;
  moeda: string;
  valorEsperado: number;
  /** Total já recebido na cobrança (parciais anteriores). Default 0. */
  jaRecebido?: number;
  /** Saldo devedor restante; base da baixa. Default = valorEsperado (sem parciais). */
  saldoRestante?: number;
  onClose: () => void;
  onDone: () => void;
  onErro: (e: string) => void;
}) {
  // A baixa parte do saldo restante (issue #10): pagar o que falta, não o negociado cheio.
  const saldo = saldoRestante ?? valorEsperado;
  const [valor, setValor] = useState(String(saldo));
  const [forma, setForma] = useState<FormaPagamento>(FormaPagamento.TRANSFERENCIA);
  const [data, setData] = useState("");
  const [comprovanteUrl, setComp] = useState("");
  const [comprovanteNome, setCompNome] = useState("");
  const [comentario, setComentario] = useState("");
  const [permitirExcedente, setPermitirExcedente] = useState(false);
  const [salvando, setSalvando] = useState(false);

  // diff compara o pagamento atual com o SALDO restante (coerente com acumularPagamento no backend).
  const diff = saldo - Number(valor || 0);
  const exigeComprovante = FORMAS_EXIGEM_COMPROVANTE.includes(forma);
  const faltaComprovante = exigeComprovante && !comprovanteUrl;

  async function salvar() {
    if (faltaComprovante) {
      onErro(`Anexe o comprovante para pagamentos via ${FORMA_PAGAMENTO_LABEL[forma]}.`);
      return;
    }
    setSalvando(true);
    const r = await registrarPagamento(cobrancaId, {
      valorRecebido: valor === "" ? 0 : Number(valor),
      forma,
      dataPagamento: data,
      comprovanteUrl,
      comprovanteNome,
      comentario,
      permitirExcedente,
    });
    setSalvando(false);
    if (!r.ok) onErro(r.erro);
    else onDone();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-lg bg-surface p-5" onClick={(e) => e.stopPropagation()}>
        <h3 className="mb-3 text-sm font-medium">
          Registrar pagamento{alunoNome ? ` — ${alunoNome}` : ""}
        </h3>
        <p className="text-xs text-gray-600">Negociado: {formatarMoeda(valorEsperado, moeda)}</p>
        {jaRecebido > 0 && (
          <p className="text-xs text-gray-600">Já recebido: {formatarMoeda(jaRecebido, moeda)}</p>
        )}
        <label className="mb-1 block text-xs font-medium text-gray-600">
          Saldo restante: {formatarMoeda(saldo, moeda)}
        </label>
        <input type="number" step="0.01" className={inputCls + " mb-1"} value={valor} onChange={(e) => setValor(e.target.value)} />
        {diff > 0 && <p className="mb-2 text-xs text-amber-600">Parcial — saldo {formatarMoeda(diff, moeda)}.</p>}
        {diff < 0 && (
          <label className="mb-2 flex items-center gap-2 text-xs text-amber-700">
            <input type="checkbox" checked={permitirExcedente} onChange={(e) => setPermitirExcedente(e.target.checked)} />
            Acima do negociado — registrar excedente de {formatarMoeda(-diff, moeda)} como crédito.
          </label>
        )}
        <label className="mb-1 mt-2 block text-xs text-gray-600">Forma</label>
        <select className={inputCls + " mb-2"} value={forma} onChange={(e) => setForma(e.target.value as FormaPagamento)}>
          {Object.values(FormaPagamento).map((f) => <option key={f} value={f}>{FORMA_PAGAMENTO_LABEL[f]}</option>)}
        </select>
        <label className="mb-1 block text-xs text-gray-600">Data (opcional)</label>
        <input type="date" className={inputCls + " mb-2"} value={data} onChange={(e) => setData(e.target.value)} />
        <label className="mb-1 block text-xs text-gray-600">
          Comprovante (PDF/JPG/PNG){exigeComprovante && <span className="text-red-600"> *</span>}
        </label>
        <div className="mb-2">
          <UploadArquivo
            label="Anexar comprovante"
            onUpload={(r) => { setComp(r.url); setCompNome(r.nome); }}
          />
          {comprovanteUrl && (
            <a href={comprovanteUrl} target="_blank" className="mt-1 block text-xs text-brand-700 hover:underline">
              ✓ {comprovanteNome || "comprovante anexado"}
            </a>
          )}
          {faltaComprovante && (
            <p className="mt-1 text-xs text-amber-600">
              Comprovante obrigatório para {FORMA_PAGAMENTO_LABEL[forma]}.
            </p>
          )}
        </div>
        <label className="mb-1 block text-xs text-gray-600">Comentário</label>
        <input className={inputCls + " mb-4"} value={comentario} onChange={(e) => setComentario(e.target.value)} />
        <div className="flex gap-2">
          <button className={btnPri} disabled={salvando || faltaComprovante} onClick={salvar}>
            {salvando ? "Salvando…" : "Registrar pagamento"}
          </button>
          <button className="rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50" onClick={onClose}>Cancelar</button>
        </div>
      </div>
    </div>
  );
}
