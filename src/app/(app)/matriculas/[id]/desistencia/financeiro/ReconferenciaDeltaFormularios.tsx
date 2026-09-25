"use client";

import { useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { aplicarReconferenciaDeltaDesistencia, decidirAdministrativamenteReconferenciaDeltaDesistencia, decidirReconferenciaDeltaDesistencia, prepararReconferenciaDeltaDesistencia } from "@/server/matricula/desistencia-reconferencia-delta";
import { MensagemStatus } from "@/components/MensagemStatus";
import { botaoClasses } from "@/components/Botao";
import { MSG_RESULTADO_INCERTO } from "@/lib/mensagens";
import { CampoTexto } from "@/components/CampoTexto";

type ResultadoAcao = { ok: boolean; erro?: string };
type Tentativa = { acao: () => Promise<ResultadoAcao>; sucesso: string };

function useOperacaoDelta() {
  const router = useRouter();
  const chave = useRef(crypto.randomUUID());
  const tentativa = useRef<Tentativa | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [incerta, setIncerta] = useState(false);
  const [mensagem, setMensagem] = useState("");

  async function executar(novaTentativa?: Tentativa) {
    const atual = tentativa.current ?? novaTentativa;
    if (!atual || ocupado) return;
    tentativa.current = atual;
    setOcupado(true);
    setMensagem("");
    try {
      const resultado = await atual.acao();
      if (!resultado.ok) {
        tentativa.current = null;
        chave.current = crypto.randomUUID();
        setIncerta(false);
        setMensagem(resultado.erro ?? "Não foi possível concluir a operação.");
        return;
      }
      tentativa.current = null;
      chave.current = crypto.randomUUID();
      setIncerta(false);
      setMensagem(atual.sucesso);
      router.refresh();
    } catch {
      setIncerta(true);
      setMensagem(MSG_RESULTADO_INCERTO);
    } finally {
      setOcupado(false);
    }
  }

  return { ocupado, incerta, mensagem, chave, iniciar: executar, reconciliar: () => executar() };
}

function ReconciliarTentativaDelta({ op }: { op: ReturnType<typeof useOperacaoDelta> }) {
  return op.incerta && <button type="button" disabled={op.ocupado} className={botaoClasses({ variante: "secundario", tamanho: "lg" })} onClick={() => void op.reconciliar()}>
    {op.ocupado ? "Reconciliando…" : "Reconciliar mesma tentativa"}
  </button>;
}

export function PrepararReconferenciaDeltaFormulario({ aplicacaoBaseId }: { aplicacaoBaseId: string }) {
  const op = useOperacaoDelta();
  return <form className="space-y-3 rounded border p-4" onSubmit={(event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const dados = new FormData(event.currentTarget);
    const entrada = { aplicacaoBaseId, motivo: String(dados.get("motivo") ?? ""), chaveIdempotencia: op.chave.current };
    void op.iniciar({ acao: () => prepararReconferenciaDeltaDesistencia(entrada), sucesso: "Reconferência preparada. As decisões financeira e administrativa são independentes." });
  }}>
    <h3 className="font-medium">Reconferir somente a diferença</h3><p>O servidor relê caixa, origens, créditos e saldo disponível. Esta etapa não remove recebimentos nem recria créditos externos.</p>
    <fieldset disabled={op.ocupado || op.incerta}><label className="block">Motivo<CampoTexto name="motivo" required minLength={5} maxLength={3000} className="mt-1 block w-full rounded border p-2" /></label><button className={`${botaoClasses({ variante: "secundario", tamanho: "lg" })} mt-3`}>{op.ocupado ? "Preparando…" : "Preparar reconferência"}</button></fieldset><ReconciliarTentativaDelta op={op} /><MensagemStatus texto={op.mensagem} />
  </form>;
}

export function DecidirReconferenciaDeltaFormulario({ propostaId, fotografiaHash, administrativo }: { propostaId: string; fotografiaHash: string; administrativo: boolean }) {
  const op = useOperacaoDelta();
  const decidir = administrativo ? decidirAdministrativamenteReconferenciaDeltaDesistencia : decidirReconferenciaDeltaDesistencia;
  return <form className="space-y-3" onSubmit={(event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const dados = new FormData(event.currentTarget);
    const entrada = { propostaId, fotografiaHash, aprovada: dados.get("decisao") === "aprovar", motivo: String(dados.get("motivo") ?? ""), chaveIdempotencia: op.chave.current };
    void op.iniciar({ acao: () => decidir(entrada), sucesso: "Decisão independente registrada." });
  }}>
    <fieldset disabled={op.ocupado || op.incerta}><label>Decisão<select name="decisao" required className="ml-2 rounded border p-2"><option value="">Selecione</option><option value="aprovar">Aprovar</option><option value="rejeitar">Rejeitar</option></select></label><label className="mt-2 block">Justificativa<CampoTexto name="motivo" required minLength={5} maxLength={3000} className="mt-1 block w-full rounded border p-2" /></label><button className={`${botaoClasses({ variante: "secundario", tamanho: "lg" })} mt-3`}>{op.ocupado ? "Registrando…" : administrativo ? "Registrar decisão administrativa" : "Registrar decisão financeira"}</button></fieldset><ReconciliarTentativaDelta op={op} /><MensagemStatus texto={op.mensagem} />
  </form>;
}

export function AplicarReconferenciaDeltaFormulario({ decisaoFinanceiraId }: { decisaoFinanceiraId: string }) {
  const op = useOperacaoDelta();
  return <div className="space-y-2"><p>Aplica somente os ajustes calculados. Uma reconferência sem diferença é concluída sem criar novo crédito.</p><button disabled={op.ocupado || op.incerta} className={botaoClasses({ variante: "secundario", tamanho: "lg" })} onClick={() => void op.iniciar({ acao: () => aplicarReconferenciaDeltaDesistencia({ decisaoFinanceiraId, chaveIdempotencia: op.chave.current }), sucesso: "Reconferência aplicada. A Secretaria ainda precisa efetivar a desistência." })}>{op.ocupado ? "Aplicando…" : "Aplicar reconferência"}</button><ReconciliarTentativaDelta op={op} /><MensagemStatus texto={op.mensagem} /></div>;
}
