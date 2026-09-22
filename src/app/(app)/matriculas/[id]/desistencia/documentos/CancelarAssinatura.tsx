"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { executarCancelamentoAssinaturaDesistencia } from "@/server/matricula/desistencia-cancelamento-assinatura";

/** A ação revalida pedido, decisão administrativa e acerto aplicado; aqui só se dispara e mostra o resultado. */
export function CancelarAssinatura({ pedidoId, processoId, estadoHash }: { pedidoId: string; processoId: string; estadoHash: string }) {
  const router = useRouter(), [pendente, iniciar] = useTransition(), [mensagem, setMensagem] = useState("");
  return <form className="space-y-2" onSubmit={(e) => {
    e.preventDefault(); setMensagem("");
    iniciar(async () => {
      const r = await executarCancelamentoAssinaturaDesistencia({ pedidoId, processoId, estadoHash });
      if (!r.ok) setMensagem(r.erro);
      else { setMensagem(r.dado?.cancelamentoConfirmado ? "O serviço confirmou o cancelamento do envio." : "O serviço não confirmou o cancelamento. O resultado ficou registrado como incerto; repita para conciliar."); router.refresh(); }
    });
  }}>
    <p>O cancelamento exige desistência autorizada pela administração e acerto aplicado. Cancelar o envio não efetiva a desistência.</p>
    {mensagem && <p role="status">{mensagem}</p>}
    <button className="rounded border px-4 py-2" disabled={pendente}>{pendente ? "Aguarde…" : "Cancelar envio no serviço de assinatura"}</button>
  </form>;
}
