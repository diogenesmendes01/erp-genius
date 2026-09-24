"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { confirmarAceiteOriginal } from "@/server/contratos/aceite";
import { MensagemStatus } from "@/components/MensagemStatus";

export function ConferirAceite({ matriculaId, conclusaoId, revisaoHash }: { matriculaId: string; conclusaoId: string; revisaoHash: string }) {
  const router = useRouter(), [pendente, iniciar] = useTransition(), [mensagem, setMensagem] = useState("");
  const [chave] = useState(() => crypto.randomUUID());
  return <form className="space-y-3 rounded border p-4" onSubmit={e => {
    e.preventDefault(); const d = new FormData(e.currentTarget); setMensagem("");
    if (d.get("conferido") !== "on") { setMensagem("Confira os documentos e as condições antes de confirmar."); return; }
    iniciar(async () => {
      try {
        const r = await confirmarAceiteOriginal({ matriculaId, conclusaoId, revisaoHash, evidenciasConferidas: true, motivo: String(d.get("motivo") ?? ""), chaveIdempotencia: chave });
        if (!r.ok) setMensagem(r.erro); else { setMensagem("Aceite registrado. A ativação continua sujeita aos demais requisitos da matrícula."); router.refresh(); }
      } catch { setMensagem("Não foi possível confirmar o resultado. Atualize a consulta antes de tentar novamente."); }
    });
  }}>
    <label className="block"><input type="checkbox" name="conferido" required disabled={pendente} /> Conferi o original, o PDF assinado, a auditoria, todas as assinaturas exigidas e as condições desta matrícula.</label>
    <label className="block">Registro da conferência<textarea name="motivo" className="block w-full rounded border p-2" required minLength={5} maxLength={2000} disabled={pendente} /></label>
    <MensagemStatus texto={mensagem} />
    <button className="rounded border px-4 py-2" disabled={pendente}>{pendente ? "Registrando…" : "Confirmar aceite do original assinado"}</button>
  </form>;
}
