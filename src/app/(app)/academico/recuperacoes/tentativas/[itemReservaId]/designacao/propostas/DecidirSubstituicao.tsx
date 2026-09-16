"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { decidirSubstituicaoRecuperacao } from "@/server/avaliacoes/recuperacao-substituicao-proposta";

export function DecidirSubstituicao({ propostaId, propostaHash, podeAprovar }: { propostaId: string; propostaHash: string; podeAprovar: boolean }) {
  const router = useRouter();
  const [ocupado, iniciar] = useTransition();
  const [erro, setErro] = useState("");
  const [mensagem, setMensagem] = useState("");

  return <form className="space-y-3 border-t pt-3" onSubmit={e => {
    e.preventDefault();
    const dados = new FormData(e.currentTarget);
    const aprovar = dados.get("decisao") === "aprovar";
    iniciar(async () => {
      setErro(""); setMensagem("");
      try {
        const r = await decidirSubstituicaoRecuperacao({ propostaId, propostaHash, aprovar, motivo: String(dados.get("motivo") ?? "") });
        if (!r.ok) { setErro(r.erro); return; }
        setMensagem(aprovar ? "Substituição aprovada e aplicada conjuntamente à agenda e à designação." : "Proposta rejeitada; o histórico foi preservado.");
        router.refresh();
      } catch {
        setErro("O resultado não foi confirmado. Consulte a proposta antes de repetir a decisão.");
      }
    });
  }}>
    <fieldset disabled={ocupado} className="space-y-3">
      <legend className="font-medium">Decisão independente</legend>
      <p className="text-sm">A decisão é registrada por outra pessoa autorizada. Aprovar aplica a troca do avaliador e a designação na mesma operação; não há etapa manual de aplicação.</p>
      <label className="block">Decisão<select name="decisao" required defaultValue="" className="block rounded border p-2">
        <option value="" disabled>Selecione</option>
        {podeAprovar && <option value="aprovar">Aprovar e aplicar a substituição</option>}
        <option value="rejeitar">Rejeitar para nova conferência</option>
      </select></label>
      <label className="block">Justificativa da decisão<textarea name="motivo" required minLength={5} maxLength={2000} className="block w-full rounded border p-2" /></label>
      <label className="block"><input type="checkbox" required /> Conferi a origem, as pendências e o estado atual antes de decidir.</label>
      <button className="rounded border px-4 py-2">{ocupado ? "Registrando…" : "Registrar decisão"}</button>
    </fieldset>
    {!podeAprovar && <p role="status" className="text-sm">A aprovação não está disponível para esta versão. A rejeição pode registrar a necessidade de uma nova conferência.</p>}
    {erro && <p role="alert">{erro}</p>}
    {mensagem && <p role="status">{mensagem}</p>}
  </form>;
}
