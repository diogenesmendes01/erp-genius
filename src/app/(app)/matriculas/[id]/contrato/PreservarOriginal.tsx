"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { preservarOriginalContratual } from "@/server/contratos/originais";

export function PreservarOriginal({ previaId, conferenciaId }: { previaId: string; conferenciaId: string }) {
  const router = useRouter(), [pendente, iniciar] = useTransition(), [erro, setErro] = useState("");
  return <form className="space-y-3 rounded border p-4" onSubmit={(e) => {
    e.preventDefault(); const d = new FormData(e.currentTarget); setErro("");
    if (d.get("conferido") !== "on") { setErro("Confirme a revisão do conteúdo e dos participantes."); return; }
    iniciar(async () => {
      const r = await preservarOriginalContratual({ previaId, conferenciaId, motivo: String(d.get("motivo") ?? ""), conteudoConferido: true });
      if (!r.ok) setErro(r.erro); else router.refresh();
    });
  }}>
    <h2 className="text-xl">Preservar original contratual</h2>
    <p>O arquivo será preservado com os participantes conferidos. Esta operação não envia para assinatura nem confirma o aceite.</p>
    <label className="block"><input type="checkbox" name="conferido" required disabled={pendente} /> Conferi o conteúdo desta prévia e a identificação dos participantes.</label>
    <label className="block">Motivo do registro<textarea className="block w-full rounded border p-2" name="motivo" minLength={5} maxLength={2000} required disabled={pendente} /></label>
    {erro && <p role="alert">{erro}</p>}
    <button className="rounded border px-4 py-2" disabled={pendente}>{pendente ? "Gerando e preservando…" : "Gerar e preservar original"}</button>
  </form>;
}
