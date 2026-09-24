"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { preservarOriginalAditivo } from "@/server/contratos/aditivo-originais";
import { MensagemStatus } from "@/components/MensagemStatus";
export function OriginalFormulario({ matriculaId, propostaId, conferencia }: { matriculaId: string; propostaId: string; conferencia: { id: string; versao: number; revisaoHash: string } }) {
  const router = useRouter(), [pendente, iniciar] = useTransition(), [mensagem, setMensagem] = useState("");
  return <form className="space-y-3 rounded border p-3" onSubmit={e => {
    e.preventDefault(); const motivo = String(new FormData(e.currentTarget).get("motivo") ?? "").trim(); setMensagem("");
    iniciar(async () => { try {
      const r = await preservarOriginalAditivo({ matriculaId, propostaId, conferenciaId: conferencia.id, conferenciaHash: conferencia.revisaoHash, motivo, conteudoConferido: true });
      if (!r.ok) { setMensagem(r.erro); return; } setMensagem("Original do aditivo preservado. Consulte o PDF abaixo."); router.refresh();
    } catch { setMensagem("Não foi possível confirmar a geração. Consulte os originais ou repita a solicitação para recuperar o mesmo registro."); } });
  }}>
    <p>Gerar com a conferência de signatários versão {conferencia.versao}.</p>
    <label className="block">Motivo<textarea className="mt-1 block w-full rounded border p-2" name="motivo" minLength={5} maxLength={2000} required disabled={pendente} /></label>
    <label className="block"><input type="checkbox" required disabled={pendente} /> Conferi o texto, as alterações, a vigência e os signatários deste aditivo.</label>
    <button className="rounded border px-4 py-2" disabled={pendente}>{pendente ? "Gerando…" : "Gerar e preservar original do aditivo"}</button>
    <MensagemStatus texto={mensagem} />
  </form>;
}
