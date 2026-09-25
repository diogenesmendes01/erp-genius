"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { registrarConferenciaFinalAditivo } from "@/server/contratos/aditivo-conferencia-final";
import { botaoClasses } from "@/components/Botao";
import { MSG_RESULTADO_INCERTO_SEM_CHAVE } from "@/lib/mensagens";
export function ConferenciaFinalFormulario({ matriculaId, propostaId, conclusaoId, revisaoHash }: { matriculaId: string; propostaId: string; conclusaoId: string; revisaoHash: string }) {
  const router = useRouter(), [pendente, iniciar] = useTransition(), [mensagem, setMensagem] = useState("");
  return <form className="space-y-3 rounded border p-4" onSubmit={event => { event.preventDefault(); const d = new FormData(event.currentTarget); if (d.get("documento") !== "on" || d.get("evidencias") !== "on") { setMensagem("Confirme o documento e as evidências preservadas."); return; } iniciar(async () => { try { const r = await registrarConferenciaFinalAditivo({ matriculaId, propostaId, conclusaoId, revisaoHash, documentoConferido: true, evidenciasConferidas: true, motivo: String(d.get("motivo") ?? "") }); if (!r.ok) setMensagem(r.erro); else { setMensagem("Conferência interna registrada."); router.refresh(); } } catch { setMensagem(MSG_RESULTADO_INCERTO_SEM_CHAVE); } }); }}>
    <h2 className="text-xl">Conferência final interna</h2><p>Esta conferência não aplica condições novas nem altera a matrícula.</p>
    <label className="block"><input type="checkbox" name="documento" disabled={pendente} /> Conferi o PDF assinado preservado.</label><label className="block"><input type="checkbox" name="evidencias" disabled={pendente} /> Conferi as evidências preservadas.</label>
    <label className="block">Motivo<textarea className="mt-1 block w-full rounded border p-2" name="motivo" minLength={5} maxLength={2000} required disabled={pendente} /></label>{mensagem && <p role="alert">{mensagem}</p>}<button className={botaoClasses({ variante: "secundario", tamanho: "lg" })} disabled={pendente}>{pendente ? "Registrando…" : "Registrar conferência interna"}</button>
  </form>;
}
