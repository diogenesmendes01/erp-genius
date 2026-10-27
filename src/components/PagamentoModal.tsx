"use client";

import { useId, useState } from "react";
import { FormaPagamento } from "@prisma/client";
import { FORMA_PAGAMENTO_LABEL } from "@/lib/labels";
import { formatarMoeda, formatarMoedaParaCampo, parseMoeda } from "@/lib/dinheiro";
import { registrarPagamento } from "@/server/financeiro/acoes";
import { UploadArquivo } from "@/components/UploadArquivo";
import { CampoMoeda } from "@/components/CampoMoeda";
import { FeedbackAcao } from "@/components/FeedbackAcao";
import { Modal } from "@/components/Modal";
import { botaoClasses } from "@/components/Botao";
import { useAcaoCliente } from "@/lib/acao-cliente";

const inputCls = "w-full rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-brand-500";
const btnPri = botaoClasses();

export const FORMAS_EXIGEM_COMPROVANTE: FormaPagamento[] = [
  FormaPagamento.TRANSFERENCIA,
  FormaPagamento.GREENPAY,
];

export function PagamentoModal({
  cobrancaId,
  somenteInformar = false,
  alunoNome,
  moeda,
  valorEsperado,
  jaRecebido = 0,
  saldoRestante,
  onClose,
  onDone,
}: {
  cobrancaId: string;
  somenteInformar?: boolean;
  alunoNome?: string;
  moeda: string;
  valorEsperado: number;
  jaRecebido?: number;
  saldoRestante?: number;
  onClose: () => void;
  onDone: () => void;
}) {
  const saldo = saldoRestante ?? valorEsperado;
  const [chaveIdempotencia] = useState(() => crypto.randomUUID());
  const [valor, setValor] = useState(() => formatarMoedaParaCampo(saldo, moeda));
  const [forma, setForma] = useState<FormaPagamento>(FormaPagamento.TRANSFERENCIA);
  const [data, setData] = useState("");
  const [comprovanteUrl, setComp] = useState("");
  const [comprovanteNome, setCompNome] = useState("");
  const [comentario, setComentario] = useState("");
  const [permitirExcedente, setPermitirExcedente] = useState(false);
  const acao = useAcaoCliente({ idempotente: true });
  const campoId = useId();

  const diff = saldo - (parseMoeda(valor) ?? 0);
  const exigeComprovante = FORMAS_EXIGEM_COMPROVANTE.includes(forma);
  const faltaComprovante = exigeComprovante && !comprovanteUrl;
  const faltaEvidencia = !somenteInformar && comentario.trim().length < 5;

  async function salvar() {
    if (faltaEvidencia) {
      acao.setErro("Descreva a evidência do recebimento e sua destinação nesta cobrança (mínimo de 5 caracteres).");
      return;
    }
    if (faltaComprovante) {
      acao.setErro(`Anexe o comprovante para pagamentos via ${FORMA_PAGAMENTO_LABEL[forma]}.`);
      return;
    }
    const valorRecebido = parseMoeda(valor);
    if (valorRecebido === null) {
      acao.setErro("Informe o valor recebido, com no máximo duas casas decimais.");
      return;
    }
    const desfecho = await acao.executar(() => registrarPagamento(cobrancaId, {
      chaveIdempotencia,
      valorRecebido,
      forma,
      dataPagamento: data,
      comprovanteUrl,
      comprovanteNome,
      comentario,
      permitirExcedente,
    }));
    if (desfecho?.tipo === "ok") onDone();
  }

  return (
    <Modal
      titulo={<>{somenteInformar ? "Informar pagamento a conferir" : "Registrar recebimento"}{alunoNome ? ` — ${alunoNome}` : ""}</>}
      aoFechar={onClose}
      bloquearFechamento={acao.ocupado}
    >
      {somenteInformar && <p className="mb-3 text-sm text-blue-700">O Financeiro conferirá este informe. O saldo permanece em aberto até a confirmação.</p>}
      <p className="text-xs text-gray-600">Negociado: {formatarMoeda(valorEsperado, moeda)}</p>
      {jaRecebido > 0 && (
        <p className="text-xs text-gray-600">Já recebido: {formatarMoeda(jaRecebido, moeda)}</p>
      )}
      <p className="mb-1 block text-xs font-medium text-gray-600">
        Saldo restante: {formatarMoeda(saldo, moeda)}
      </p>
      <CampoMoeda id={`${campoId}-valor`} value={valor} onChange={setValor} moeda={moeda} className={inputCls + " mb-1"} ariaLabel="Valor recebido" />
      {diff > 0 && <p className="mb-2 text-xs text-amber-600">Parcial — saldo {formatarMoeda(diff, moeda)}.</p>}
      {diff < 0 && (
        <label className="mb-2 flex items-center gap-2 text-xs text-amber-700">
          <input type="checkbox" checked={permitirExcedente} onChange={(e) => setPermitirExcedente(e.target.checked)} />
          Acima do negociado — registrar excedente de {formatarMoeda(-diff, moeda)} como crédito.
        </label>
      )}
      <label htmlFor={`${campoId}-forma`} className="mb-1 mt-2 block text-xs text-gray-600">Forma</label>
      <select id={`${campoId}-forma`} className={inputCls + " mb-2"} value={forma} onChange={(e) => setForma(e.target.value as FormaPagamento)}>
        {Object.values(FormaPagamento).map((f) => <option key={f} value={f}>{FORMA_PAGAMENTO_LABEL[f]}</option>)}
      </select>
      <label htmlFor={`${campoId}-data`} className="mb-1 block text-xs text-gray-600">Data (opcional)</label>
      <input id={`${campoId}-data`} type="date" className={inputCls + " mb-2"} value={data} onChange={(e) => setData(e.target.value)} />
      <p className="mb-1 block text-xs text-gray-600">
        Comprovante (PDF/JPG/PNG){exigeComprovante && <span className="text-red-600"> *</span>}
      </p>
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
      <label htmlFor={`${campoId}-comentario`} className="mb-1 block text-xs text-gray-600">{somenteInformar ? "Comentário" : "Evidência do recebimento e destinação *"}</label>
      <input id={`${campoId}-comentario`} aria-required={!somenteInformar} className={inputCls + " mb-4"} value={comentario} onChange={(e) => setComentario(e.target.value)} />
      <FeedbackAcao erro={acao.erro} className="mb-3" />
      <div className="flex gap-2">
        <button className={btnPri} disabled={acao.ocupado || faltaComprovante || faltaEvidencia} onClick={salvar}>
          {acao.ocupado ? "Salvando…" : somenteInformar ? "Enviar para conferência" : "Registrar recebimento"}
        </button>
        <button type="button" className={botaoClasses({ variante: "secundario" })} disabled={acao.ocupado} onClick={onClose}>Cancelar</button>
      </div>
    </Modal>
  );
}
