"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Botao } from "@/components/Botao";
import { Campo } from "@/components/Campo";
import { CampoTexto } from "@/components/CampoTexto";
import { FeedbackAcao } from "@/components/FeedbackAcao";
import { useAcaoCliente } from "@/lib/acao-cliente";
import { useChaveIdempotencia } from "@/lib/chave-idempotencia";
import { decidirCorrecaoRelatoIndisponibilidadeOferta, proporCorrecaoRelatoIndisponibilidadeOferta } from "@/server/matricula/indisponibilidade-oferta-correcao";

const CONTROLE = "block w-full rounded border p-2";

/** Q157. Datas civis: o navegador não reinterpreta fuso. Relato aberto não recebe fim por aqui (término, Q156). */
export function ProporCorrecaoRelato({ registroId, inicio, fim }: { registroId: string; inicio: string; fim: string | null }) {
  const router = useRouter();
  // A proposta leva chave estável: o reenvio idêntico devolve a mesma versão.
  const acao = useAcaoCliente({ idempotente: true });
  const tentativa = useChaveIdempotencia();
  const [novoInicio, setNovoInicio] = useState(inicio);
  const [novoFim, setNovoFim] = useState(fim ?? "");
  const [motivo, setMotivo] = useState("");
  const [evidencia, setEvidencia] = useState("");

  return <form className="space-y-3 rounded border p-4" onSubmit={async (evento) => {
    evento.preventDefault();
    const desfecho = await acao.executar(() => proporCorrecaoRelatoIndisponibilidadeOferta({
      registroId, inicio: novoInicio, fim: fim === null ? null : novoFim, motivo, evidenciaTexto: evidencia, chaveIdempotencia: tentativa.atual,
    }), "Correção proposta. O relato só muda depois da aprovação de outra pessoa.");
    tentativa.depoisDo(desfecho);
    if (desfecho?.tipo === "ok") router.refresh();
  }}>
    <h2 className="text-xl">Propor correção do período</h2>
    <fieldset disabled={acao.ocupado} className="space-y-3">
      <Campo rotulo="Início correto" obrigatorio>{(campo) => <input {...campo} className={CONTROLE} type="date" name="inicio" required value={novoInicio} onChange={(e) => setNovoInicio(e.target.value)} />}</Campo>
      {fim === null
        ? <p>Relato em aberto: o último dia é registrado pelo término da indisponibilidade, não pela correção.</p>
        : <Campo rotulo="Fim correto" obrigatorio>{(campo) => <input {...campo} className={CONTROLE} type="date" name="fim" min={novoInicio} required value={novoFim} onChange={(e) => setNovoFim(e.target.value)} />}</Campo>}
      <Campo rotulo="Motivo" obrigatorio>{(campo) => <CampoTexto {...campo} className={CONTROLE} minLength={5} maxLength={2000} required value={motivo} onChange={(e) => setMotivo(e.target.value)} />}</Campo>
      <Campo rotulo="Evidência" obrigatorio>{(campo) => <CampoTexto {...campo} className={CONTROLE} minLength={5} maxLength={4000} required value={evidencia} onChange={(e) => setEvidencia(e.target.value)} />}</Campo>
    </fieldset>
    <FeedbackAcao erro={acao.erro} sucesso={acao.sucesso} />
    <Botao type="submit" variante="secundario" tamanho="lg" ocupado={acao.ocupado}>{acao.ocupado ? "Registrando…" : "Propor correção"}</Botao>
  </form>;
}

/** Q157: decisão independente. Aprovada, o relato passa ao novo período na mesma transação. */
export function DecidirCorrecaoRelato({ propostaId }: { propostaId: string }) {
  const router = useRouter();
  // Sem chave: a decisão é única por proposta e o reenvio idêntico devolve a mesma decisão pelo hash da entrada.
  const acao = useAcaoCliente({ idempotente: false });
  const [motivo, setMotivo] = useState("");
  const [evidencia, setEvidencia] = useState("");

  async function decidir(aprovada: boolean, formulario: HTMLFormElement | null) {
    if (formulario && !formulario.reportValidity()) return;
    const desfecho = await acao.executar(
      () => decidirCorrecaoRelatoIndisponibilidadeOferta({ propostaId, aprovada, motivo, evidenciaTexto: evidencia }),
      aprovada ? "Correção aprovada: o relato passou a refletir o novo período." : "Correção rejeitada; o relato permanece como estava.",
    );
    if (desfecho?.tipo === "ok") router.refresh();
  }

  return <form className="space-y-3 rounded border p-4" onSubmit={(e) => e.preventDefault()}>
    <h2 className="text-xl">Decidir correção pendente</h2>
    <p>Confira a oferta no período corrigido. Aprovar altera o período do relato e os cálculos que dele dependem; não altera cobranças por si só.</p>
    <fieldset disabled={acao.ocupado} className="space-y-3">
      <Campo rotulo="Motivo da decisão" obrigatorio>{(campo) => <CampoTexto {...campo} className={CONTROLE} minLength={5} maxLength={2000} required value={motivo} onChange={(e) => setMotivo(e.target.value)} />}</Campo>
      <Campo rotulo="Evidência conferida" obrigatorio>{(campo) => <CampoTexto {...campo} className={CONTROLE} minLength={5} maxLength={4000} required value={evidencia} onChange={(e) => setEvidencia(e.target.value)} />}</Campo>
    </fieldset>
    <FeedbackAcao erro={acao.erro} sucesso={acao.sucesso} />
    <div className="flex flex-wrap gap-3">
      <Botao variante="secundario" tamanho="lg" ocupado={acao.ocupado} onClick={(e) => decidir(true, e.currentTarget.form)}>Aprovar correção</Botao>
      <Botao variante="perigo" tamanho="lg" ocupado={acao.ocupado} onClick={(e) => decidir(false, e.currentTarget.form)}>Rejeitar correção</Botao>
    </div>
  </form>;
}
