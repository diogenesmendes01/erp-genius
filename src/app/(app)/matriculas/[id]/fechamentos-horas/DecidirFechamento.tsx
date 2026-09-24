"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { decidirFechamentoHoras } from "@/server/matricula/fechamento-horas-decisao";
import { MensagemStatus } from "@/components/MensagemStatus";

export function DecidirFechamento({ alunoId, matriculaId, rascunhoId }: { alunoId: string; matriculaId: string; rascunhoId: string }) {
  const router = useRouter(), [ocupado, iniciar] = useTransition(), [mensagem, setMensagem] = useState(""), [decisao, setDecisao] = useState("");
  return <form className="space-y-3 rounded border p-4" onSubmit={e => {
    e.preventDefault(); const f = new FormData(e.currentTarget);
    iniciar(async () => {
      setMensagem("");
      try {
        const r = await decidirFechamentoHoras({ alunoId, matriculaId, rascunhoId, aprovar: decisao === "APROVAR",
          confirmaReferenciaContratual: f.get("referencia") === "on", motivo: String(f.get("motivo")) });
        setMensagem(r.ok ? "Decisão registrada. Nenhuma cobrança emitida." : r.erro);
        if (r.ok) router.refresh();
      } catch { setMensagem("Resultado não confirmado. Atualize o histórico antes de repetir a decisão."); }
    });
  }}><fieldset disabled={ocupado} className="space-y-3"><legend className="font-medium">Decisão independente</legend>
    <label className="block">Decisão<select className="block w-full rounded border p-2" required value={decisao} onChange={e => setDecisao(e.target.value)}>
      <option value="">Selecione</option><option value="APROVAR">Aprovar a proposta apresentada</option><option value="REJEITAR">Rejeitar a proposta</option>
    </select></label>
    {decisao === "APROVAR" && <label className="block"><input name="referencia" type="checkbox" required /> Conferi no contrato a referência, o período, o fuso e o vencimento propostos, além da escolha de aguardar ou propor emissão parcial.</label>}
    <label className="block">Justificativa<textarea className="block w-full rounded border p-2" name="motivo" required minLength={5} maxLength={2000} /></label>
    <p>Aprovar revalida as origens. Se mudaram, prepare nova versão. A decisão não emite cobrança.</p>
    <button className="rounded border p-2">{ocupado ? "Registrando…" : "Registrar decisão"}</button>
  </fieldset><MensagemStatus texto={mensagem} /></form>;
}
