"use client";
import { useRouter } from "next/navigation";
import { efetivarAcertoEncerramento } from "@/server/matricula/encerramento-efetivar";
import { FeedbackAcao } from "@/components/FeedbackAcao";
import { botaoClasses } from "@/components/Botao";
import { useAcaoCliente } from "@/lib/acao-cliente";

export function EfetivarAcerto({ alunoId, decisaoId, atualizar }: { alunoId: string; decisaoId: string; atualizar: () => void }) {
  // Idempotente por natureza (#166): a efetivação é única por solicitação e o reenvio com a mesma decisão devolve
  // a efetivação já aplicada (server/matricula/encerramento-efetivar-tx.ts). Na falha de transporte, reenviar.
  const acao = useAcaoCliente({ idempotente: true });
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
