"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { confirmarResolucaoImpedimentoSegundaChamada } from "@/server/avaliacoes/segunda-chamada-resolucao-impedimento";

/** Q164: a gestão aponta a realização posterior com nota oficial; o impedimento original permanece no histórico. */
export function ResolverImpedimento({ reservaImpedidaId, realizacoes }: { reservaImpedidaId: string; realizacoes: { id: string; rotulo: string }[] }) {
  const router = useRouter(), [pendente, iniciar] = useTransition(), [mensagem, setMensagem] = useState("");
  const [chave] = useState(() => crypto.randomUUID());
  return <form className="space-y-2 rounded border p-3" onSubmit={(e) => {
    e.preventDefault(); const dados = new FormData(e.currentTarget); setMensagem("");
    iniciar(async () => {
      const r = await confirmarResolucaoImpedimentoSegundaChamada({ reservaImpedidaId, realizacaoId: String(dados.get("realizacaoId") ?? ""), motivo: String(dados.get("motivo") ?? ""), chaveIdempotencia: chave });
      if (!r.ok) setMensagem(r.erro); else { setMensagem("Resolução confirmada. O impedimento deixa de bloquear o fechamento."); router.refresh(); }
    });
  }}>
    <h3 className="font-medium">Confirmar resolução do impedimento</h3>
    <label className="block">Realização posterior com nota oficial
      <select className="mt-1 block rounded border p-2" name="realizacaoId" required disabled={pendente} defaultValue={realizacoes.length === 1 ? realizacoes[0].id : ""}>
        <option value="" disabled>Selecione a realização</option>
        {realizacoes.map((z) => <option key={z.id} value={z.id}>{z.rotulo}</option>)}
      </select></label>
    <label className="block">Justificativa<textarea className="block w-full rounded border p-2" name="motivo" minLength={5} maxLength={2000} required disabled={pendente} /></label>
    {mensagem && <p role="status">{mensagem}</p>}
    <button className="rounded border px-4 py-2" disabled={pendente}>{pendente ? "Registrando…" : "Confirmar resolução"}</button>
  </form>;
}
