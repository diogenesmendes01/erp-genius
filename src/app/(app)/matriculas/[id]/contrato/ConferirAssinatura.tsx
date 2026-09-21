"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { registrarConferenciaAssinatura } from "@/server/contratos/assinatura-conferencia";

export function ConferirAssinatura({ matriculaId, artefatoId, revisaoHash }: { matriculaId: string; artefatoId: string; revisaoHash: string }) {
  const router = useRouter(), [pendente, iniciar] = useTransition(), [mensagem, setMensagem] = useState("");
  const [chave] = useState(() => crypto.randomUUID());
  return <form className="space-y-3 rounded border p-4" onSubmit={(e) => {
    e.preventDefault(); const dados = new FormData(e.currentTarget); setMensagem("");
    if (dados.get("conferido") !== "on") { setMensagem("Confirme os dados revisados."); return; }
    iniciar(async () => {
      const r = await registrarConferenciaAssinatura({ matriculaId, artefatoId, revisaoHash, dadosConferidos: true, motivo: String(dados.get("motivo") ?? ""), chaveIdempotencia: chave });
      if (!r.ok) setMensagem(r.erro); else { setMensagem("Conferência registrada. O documento ainda não foi enviado para assinatura."); router.refresh(); }
    });
  }}>
    <label className="block"><input name="conferido" type="checkbox" required disabled={pendente} /> Conferi o original, os participantes e as condições de reserva e pagamento apresentadas.</label>
    <label className="block">Motivo<textarea className="block w-full rounded border p-2" name="motivo" minLength={5} maxLength={2000} required disabled={pendente} /></label>
    {mensagem && <p role="status">{mensagem}</p>}
    <button className="rounded border px-4 py-2" disabled={pendente}>{pendente ? "Registrando…" : "Registrar conferência para assinatura"}</button>
  </form>;
}
