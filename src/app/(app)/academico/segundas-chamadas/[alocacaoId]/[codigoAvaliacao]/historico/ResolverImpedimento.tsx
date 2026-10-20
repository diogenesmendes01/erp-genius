"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Botao } from "@/components/Botao";
import { Campo } from "@/components/Campo";
import { CampoTexto } from "@/components/CampoTexto";
import { FeedbackAcao } from "@/components/FeedbackAcao";
import { useAcaoCliente } from "@/lib/acao-cliente";
import { useChaveIdempotencia } from "@/lib/chave-idempotencia";
import { confirmarResolucaoImpedimentoSegundaChamada } from "@/server/avaliacoes/segunda-chamada-resolucao-impedimento";

const CONTROLE = "block w-full rounded border p-2";

/** Q164: a gestão aponta a realização posterior com nota oficial; o impedimento original permanece no histórico. */
export function ResolverImpedimento({ reservaImpedidaId, realizacoes }: { reservaImpedidaId: string; realizacoes: { id: string; rotulo: string }[] }) {
  const router = useRouter();
  // A action devolve a resolução já registrada quando a mesma chave chega de novo com a mesma entrada.
  const acao = useAcaoCliente({ idempotente: true });
  const tentativa = useChaveIdempotencia();
  const [realizacaoId, setRealizacaoId] = useState(realizacoes.length === 1 ? realizacoes[0].id : "");
  const [motivo, setMotivo] = useState("");

  return <form className="space-y-3 rounded border p-3" onSubmit={async (evento) => {
    evento.preventDefault();
    const desfecho = await acao.executar(
      () => confirmarResolucaoImpedimentoSegundaChamada({ reservaImpedidaId, realizacaoId, motivo, chaveIdempotencia: tentativa.atual }),
      "Resolução confirmada. O impedimento deixa de bloquear o fechamento.",
    );
    tentativa.depoisDo(desfecho);
    if (desfecho?.tipo === "ok") router.refresh();
  }}>
    <h3 className="font-medium">Confirmar resolução do impedimento</h3>
    <fieldset disabled={acao.ocupado} className="space-y-3">
      <Campo rotulo="Realização posterior com nota oficial" obrigatorio>{(campo) => (
        <select {...campo} className={CONTROLE} required value={realizacaoId} onChange={(e) => setRealizacaoId(e.target.value)}>
          <option value="" disabled>Selecione a realização</option>
          {realizacoes.map((z) => <option key={z.id} value={z.id}>{z.rotulo}</option>)}
        </select>
      )}</Campo>
      <Campo rotulo="Justificativa" obrigatorio>{(campo) => (
        <CampoTexto {...campo} className={CONTROLE} minLength={5} maxLength={2000} required value={motivo} onChange={(e) => setMotivo(e.target.value)} />
      )}</Campo>
    </fieldset>
    <FeedbackAcao erro={acao.erro} sucesso={acao.sucesso} />
    <Botao type="submit" variante="secundario" tamanho="lg" ocupado={acao.ocupado}>{acao.ocupado ? "Registrando…" : "Confirmar resolução"}</Botao>
  </form>;
}
