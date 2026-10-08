"use client";
import { useRouter } from "next/navigation";
import { efetivarAcertoEncerramento } from "@/server/matricula/encerramento-efetivar";
import { FeedbackAcao } from "@/components/FeedbackAcao";
import { botaoClasses } from "@/components/Botao";
import { useAcaoCliente } from "@/lib/acao-cliente";

export function EfetivarAcerto({ alunoId, decisaoId, atualizar }: { alunoId: string; decisaoId: string; atualizar: () => void }) {
  // Sem chave de idempotência: na falha de transporte, conferir antes de repetir (MSG_RESULTADO_INCERTO_SEM_CHAVE).
  const acao = useAcaoCliente({ idempotente: false });
  const router = useRouter();
  return <div className="space-y-2 rounded border p-3">
    <p>A efetivação aplica o acerto aprovado e encerra somente as matrículas deste pedido. Valores a devolver permanecem sujeitos ao fluxo de devolução.</p>
    <button className={botaoClasses({ variante: "perigo", tamanho: "lg" })} type="button" disabled={acao.ocupado} onClick={async () => {
      const d = await acao.executar(() => efetivarAcertoEncerramento({ alunoId, decisaoId }), "Encerramento efetivado.");
      if (d?.tipo === "ok") { atualizar(); router.refresh(); }
    }}>{acao.ocupado ? "Efetivando…" : "Efetivar encerramento aprovado"}</button>
    <FeedbackAcao erro={acao.erro} sucesso={acao.sucesso} />
  </div>;
}
