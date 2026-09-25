"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { emitirFechamentoHoras } from "@/server/matricula/fechamento-horas-emissao";
import { MensagemStatus } from "@/components/MensagemStatus";
import { formatarMoeda } from "@/lib/dinheiro";
import { botaoClasses } from "@/components/Botao";

export function EmitirFechamento({ alunoId, matriculaId, decisaoId, valor, moeda }: {
  alunoId: string; matriculaId: string; decisaoId: string; valor: string; moeda: string;
}) {
  const router = useRouter(), [ocupado, iniciar] = useTransition(), [mensagem, setMensagem] = useState("");
  return <div className="space-y-2 rounded border p-4">
    <p>Emitir cobrança de {formatarMoeda(valor, moeda)} referente aos itens desta versão aprovada. O sistema verificará novamente as origens antes da emissão.</p>
    <button disabled={ocupado} className={botaoClasses({ variante: "secundario", tamanho: "lg" })} onClick={() => iniciar(async () => {
      setMensagem("");
      try {
        const r = await emitirFechamentoHoras({ alunoId, matriculaId, decisaoId });
        setMensagem(r.ok ? "Cobrança emitida. Consulte o registro abaixo; isso não confirma pagamento." : r.erro);
        if (r.ok) router.refresh();
      } catch { setMensagem("Não foi possível confirmar o resultado. Atualize o histórico antes de repetir; a mesma decisão não gera outra cobrança."); }
    })}>{ocupado ? "Emitindo…" : "Emitir cobrança aprovada"}</button>
    <MensagemStatus texto={mensagem} />
  </div>;
}
