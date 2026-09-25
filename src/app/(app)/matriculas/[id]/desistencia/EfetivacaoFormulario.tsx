"use client";
import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { efetivarPedidoDesistenciaPreparacao } from "@/server/matricula/desistencia-efetivacao";
import { MensagemStatus } from "@/components/MensagemStatus";
import { botaoClasses } from "@/components/Botao";
import { MSG_RESULTADO_INCERTO_SEM_CHAVE } from "@/lib/mensagens";

export function EfetivacaoFormulario({ pedidoId, estadoHash, decisaoFinanceiraId }: { pedidoId: string; estadoHash: string; decisaoFinanceiraId?: string }) {
  const router = useRouter();
  const [ocupado, setOcupado] = useState(false);
  const [concluido, setConcluido] = useState(false);
  const [mensagem, setMensagem] = useState("");
  async function enviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    const dados = new FormData(evento.currentTarget);
    if (dados.get("conferencia") !== "confirmada") return;
    setOcupado(true); setMensagem("");
    try {
      const resposta = await efetivarPedidoDesistenciaPreparacao({ pedidoId, estadoHash, ...(decisaoFinanceiraId ? { decisaoFinanceiraId } : {}), motivo: String(dados.get("motivo") ?? "") });
      if (resposta.ok) { setConcluido(true); setMensagem("Desistência efetivada. As reservas disponíveis desta contratação foram liberadas."); router.refresh(); }
      else setMensagem(resposta.erro);
    } catch { setMensagem(MSG_RESULTADO_INCERTO_SEM_CHAVE); }
    finally { setOcupado(false); }
  }
  return <form onSubmit={enviar} className="space-y-3 rounded border p-4">
    <h2 className="text-lg font-medium">Efetivar desistência conferida</h2>
    <p>Esta ação cancela somente a matrícula em preparação e libera suas reservas de vaga e horário. Confira também os canais externos antes de confirmar.</p>
    {decisaoFinanceiraId && <p>O cancelamento das cobranças tem aprovação financeira. A confirmação aplicará esse tratamento junto com a desistência.</p>}
    <fieldset disabled={ocupado || concluido} className="space-y-3">
      <label className="block">Conferência final e motivo<textarea name="motivo" required minLength={10} maxLength={3000} className="mt-1 block w-full rounded border p-2" placeholder="Registre como conferiu a solicitação e a ausência de pagamento ou assinatura fora do ERP." /></label>
      <label className="block"><input type="checkbox" name="conferencia" value="confirmada" required /> Confirmei que não há pagamento, comprovante ou assinatura pendente de registro para esta contratação.</label>
      <button type="submit" className={botaoClasses({ variante: "secundario", tamanho: "lg" })}>{ocupado ? "Efetivando…" : "Confirmar desistência e liberar reservas"}</button>
    </fieldset>
    <MensagemStatus texto={mensagem} />
  </form>;
}
