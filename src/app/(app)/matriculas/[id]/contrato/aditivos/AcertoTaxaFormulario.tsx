"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { proporAcertoTaxaAditivo } from "@/server/contratos/aditivo-acerto-taxa-acoes";
import { MensagemStatus } from "@/components/MensagemStatus";
import { formatarMoeda } from "@/lib/dinheiro";
import { formatarDataCivil } from "@/lib/data-civil";
import { botaoClasses } from "@/components/Botao";
import { MSG_RESULTADO_INCERTO } from "@/lib/mensagens";

type CobrancaTaxa = {
  id: string; codigo: string | null; moeda: string;
  valorOriginal: string; valorNegociado: string; valorRecebido: string | null;
  valorLiquidadoCredito: string; saldo: string | null; vencimento: string;
  valorNovo: string; vencimentoNovo: string; creditoNovo: string;
  saldoAposAcerto: string; pendencia: { tratamento: string; valor: string } | null;
};

export function AcertoTaxaFormulario({ matriculaId, propostaAditivoId, conclusaoId, revisaoHash, cobrancas }: {
  matriculaId: string; propostaAditivoId: string; conclusaoId: string;
  revisaoHash: string; cobrancas: CobrancaTaxa[];
}) {
  const router = useRouter();
  const [cobrancaId, setCobrancaId] = useState("");
  const [motivo, setMotivo] = useState("");
  const [evidencia, setEvidencia] = useState("");
  const [mensagem, setMensagem] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const emEnvio = useRef(false);
  const tentativa = useRef<{ entrada: string; chave: string } | null>(null);
  const atual = cobrancas.find(c => c.id === cobrancaId);
  const podeEnviar = Boolean(atual && !atual.pendencia && motivo.trim().length >= 5 && evidencia.trim().length >= 5);

  async function propor() {
    if (emEnvio.current || !podeEnviar) return;
    const dados = { matriculaId, propostaAditivoId, conclusaoId, revisaoHash, cobrancaId,
      motivo: motivo.trim(), evidencia: { texto: evidencia.trim() } };
    const entrada = JSON.stringify(dados);
    if (tentativa.current?.entrada !== entrada) tentativa.current = { entrada, chave: crypto.randomUUID() };
    emEnvio.current = true;
    setOcupado(true);
    setMensagem("");
    try {
      const resultado = await proporAcertoTaxaAditivo({ ...dados, chaveIdempotencia: tentativa.current.chave });
      if (!resultado.ok) { setMensagem(resultado.erro); return; }
      setMensagem("Proposta registrada. Aguarda conferência de outra pessoa autorizada.");
      setCobrancaId(""); setMotivo(""); setEvidencia(""); tentativa.current = null;
      router.refresh();
    } catch {
      setMensagem(MSG_RESULTADO_INCERTO);
    } finally {
      emEnvio.current = false;
      setOcupado(false);
    }
  }

  return <section className="space-y-3 rounded border p-4">
    <h2 className="text-xl">Acerto da taxa emitida</h2>
    <p>Selecione a cobrança e confira os efeitos do aditivo. A proposta não confirma pagamentos nem devolve dinheiro.</p>
    {!cobrancas.length && <p role="status">Nenhuma cobrança de taxa disponível para conferência.</p>}
    <fieldset disabled={ocupado} className="space-y-3">
      <label className="block">Cobrança de taxa
        <select className="mt-1 block w-full rounded border p-2" value={cobrancaId} onChange={e => setCobrancaId(e.target.value)}>
          <option value="">Selecione a cobrança</option>
          {cobrancas.map(c => <option key={c.id} value={c.id}>{c.codigo ?? "Taxa sem código"} · {formatarMoeda(c.valorNegociado, c.moeda)} · {formatarDataCivil(c.vencimento.slice(0, 10))}</option>)}
        </select>
      </label>
      {atual && <dl className="grid gap-2 rounded bg-gray-50 p-3 sm:grid-cols-2">
        <div><dt>Valor original / negociado</dt><dd>{formatarMoeda(atual.valorOriginal, atual.moeda)} / {formatarMoeda(atual.valorNegociado, atual.moeda)}</dd></div>
        <div><dt>Recebido / liquidado com crédito</dt><dd>{atual.valorRecebido != null ? formatarMoeda(atual.valorRecebido, atual.moeda) : "não registrado"} / {formatarMoeda(atual.valorLiquidadoCredito, atual.moeda)}</dd></div>
        <div><dt>Saldo atual / após acerto</dt><dd>{atual.saldo == null ? "Não informado" : formatarMoeda(atual.saldo, atual.moeda)} / {formatarMoeda(atual.saldoAposAcerto, atual.moeda)}</dd></div>
        <div><dt>Valor após acerto</dt><dd>{formatarMoeda(atual.valorNovo, atual.moeda)}</dd></div>
        <div><dt>Vencimento atual / proposto</dt><dd>{formatarDataCivil(atual.vencimento.slice(0, 10))} / {formatarDataCivil(atual.vencimentoNovo.slice(0, 10))}</dd></div>
        <div><dt>Novo crédito apurado</dt><dd>{formatarMoeda(atual.creditoNovo, atual.moeda)}</dd></div>
      </dl>}
      {atual?.pendencia && <p role="alert">{atual.pendencia.tratamento} Valor: {formatarMoeda(atual.pendencia.valor, atual.moeda)}.</p>}
      <label className="block">Motivo<textarea className="mt-1 block w-full rounded border p-2" maxLength={2000} value={motivo} onChange={e => setMotivo(e.target.value)} /></label>
      <label className="block">Evidência conferida<textarea className="mt-1 block w-full rounded border p-2" maxLength={2000} value={evidencia} onChange={e => setEvidencia(e.target.value)} /></label>
      <button type="button" className={botaoClasses({ tamanho: "lg" })} disabled={!podeEnviar || ocupado} onClick={propor}>{ocupado ? "Registrando proposta…" : "Propor acerto"}</button>
    </fieldset>
    <MensagemStatus texto={mensagem} />
  </section>;
}
