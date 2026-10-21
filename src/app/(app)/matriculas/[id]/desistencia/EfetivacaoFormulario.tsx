"use client";
import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { efetivarPedidoDesistenciaPreparacao } from "@/server/matricula/desistencia-efetivacao";
import { FeedbackAcao } from "@/components/FeedbackAcao";
import { botaoClasses } from "@/components/Botao";
import { CampoTexto } from "@/components/CampoTexto";
import { useAcaoCliente } from "@/lib/acao-cliente";

export function EfetivacaoFormulario({ pedidoId, estadoHash, decisaoFinanceiraId }: { pedidoId: string; estadoHash: string; decisaoFinanceiraId?: string }) {
  const router = useRouter();
  const [concluido, setConcluido] = useState(false);
  // Sem chave de idempotência: na falha de transporte, conferir antes de repetir (MSG_RESULTADO_INCERTO_SEM_CHAVE).
  const acao = useAcaoCliente({ idempotente: false });
  async function enviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    const dados = new FormData(evento.currentTarget);
    if (dados.get("conferencia") !== "confirmada") return;
    const d = await acao.executar(
      () => efetivarPedidoDesistenciaPreparacao({ pedidoId, estadoHash, ...(decisaoFinanceiraId ? { decisaoFinanceiraId } : {}), motivo: String(dados.get("motivo") ?? "") }),
      "Desistência efetivada. As reservas disponíveis desta contratação foram liberadas.",
    );
    if (d?.tipo === "ok") { setConcluido(true); router.refresh(); }
  }
  return <form onSubmit={enviar} className="space-y-3 rounded border p-4">
    <h2 className="text-lg font-medium">Efetivar desistência conferida</h2>
    <p>Esta ação cancela somente a matrícula em preparação e libera suas reservas de vaga e horário. Confira também os canais externos antes de confirmar.</p>
    {decisaoFinanceiraId && <p>O cancelamento das cobranças tem aprovação financeira. A confirmação aplicará esse tratamento junto com a desistência.</p>}
    <fieldset disabled={acao.ocupado || concluido} className="space-y-3">
      <label className="block">Conferência final e motivo<CampoTexto name="motivo" required minLength={10} maxLength={3000} className="mt-1 block w-full rounded border p-2" placeholder="Registre como conferiu a solicitação e a ausência de pagamento ou assinatura fora do ERP." /></label>
      <label className="block"><input type="checkbox" name="conferencia" value="confirmada" required /> Confirmei que não há pagamento, comprovante ou assinatura pendente de registro para esta contratação.</label>
      <button type="submit" className={botaoClasses({ variante: "perigo", tamanho: "lg" })}>{acao.ocupado ? "Efetivando…" : "Confirmar desistência e liberar reservas"}</button>
    </fieldset>
    <FeedbackAcao erro={acao.erro} sucesso={acao.sucesso} />
  </form>;
}
