"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { efetivarAcertoEncerramento } from "@/server/matricula/encerramento-efetivar";
import { MensagemStatus } from "@/components/MensagemStatus";

export function EfetivarAcerto({ alunoId, decisaoId, atualizar }: { alunoId: string; decisaoId: string; atualizar: () => void }) {
  const [ocupado, setOcupado] = useState(false), [mensagem, setMensagem] = useState("");
  const router = useRouter();
  return <div className="space-y-2 rounded border p-3">
    <p>A efetivação aplica o acerto aprovado e encerra somente as matrículas deste pedido. Valores a devolver permanecem sujeitos ao fluxo de devolução.</p>
    <button type="button" disabled={ocupado} onClick={async () => {
      setOcupado(true); setMensagem("");
      try {
        const r = await efetivarAcertoEncerramento({ alunoId, decisaoId });
        if (!r.ok) { setMensagem(r.erro); return; }
        setMensagem("Encerramento efetivado."); atualizar(); router.refresh();
      } catch { setMensagem("Não foi possível confirmar o resultado. Atualize a conferência antes de repetir."); }
      finally { setOcupado(false); }
    }}>{ocupado ? "Efetivando…" : "Efetivar encerramento aprovado"}</button>
    <MensagemStatus texto={mensagem} />
  </div>;
}
