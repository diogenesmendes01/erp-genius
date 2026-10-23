"use client";
import { useRouter } from "next/navigation";
import { executarCancelamentoAssinaturaDesistencia } from "@/server/matricula/desistencia-cancelamento-assinatura";
import { FeedbackAcao } from "@/components/FeedbackAcao";
import { useAcaoCliente } from "@/lib/acao-cliente";
import { useChaveIdempotencia } from "@/lib/chave-idempotencia";
import { botaoClasses } from "@/components/Botao";

/** A ação revalida pedido, decisão administrativa e acerto aplicado; aqui só se dispara e mostra o resultado. */
export function CancelarAssinatura({ pedidoId, processoId, estadoHash }: { pedidoId: string; processoId: string; estadoHash: string }) {
  const router = useRouter(), acao = useAcaoCliente({ idempotente: true }), chave = useChaveIdempotencia();
  return <form className="space-y-2" onSubmit={async (e) => {
    e.preventDefault(); acao.limpar();
    const d = await acao.executar(() => executarCancelamentoAssinaturaDesistencia({ pedidoId, processoId, estadoHash, chaveIdempotencia: chave.atual }),
      r => r?.cancelamentoConfirmado ? "O serviço confirmou o cancelamento do envio." : "O serviço não confirmou o cancelamento. O resultado ficou registrado como incerto; repita para conciliar.");
    chave.depoisDo(d);
    if (d?.tipo === "ok") router.refresh();
  }}>
    <p>O cancelamento exige desistência autorizada pela administração e acerto aplicado. Cancelar o envio não efetiva a desistência.</p>
    <FeedbackAcao erro={acao.erro} sucesso={acao.sucesso} />
    <button className={botaoClasses({ variante: "perigo", tamanho: "lg" })} disabled={acao.ocupado}>{acao.ocupado ? "Aguarde…" : "Cancelar envio no serviço de assinatura"}</button>
  </form>;
}
