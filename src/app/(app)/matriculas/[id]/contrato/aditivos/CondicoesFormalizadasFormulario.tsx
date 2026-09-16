"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { registrarCondicoesFormalizadasAditivo } from "@/server/contratos/aditivo-condicoes";
export function CondicoesFormalizadasFormulario({ matriculaId, propostaId, conclusaoId, revisaoHash }: { matriculaId: string; propostaId: string; conclusaoId: string; revisaoHash: string }) {
  const router = useRouter(), [pendente, iniciar] = useTransition(), [mensagem, setMensagem] = useState("");
  return <form className="space-y-3 rounded border p-4" onSubmit={event => { event.preventDefault(); iniciar(async () => { try { const r = await registrarCondicoesFormalizadasAditivo({ matriculaId, propostaId, conclusaoId, revisaoHash }); if (!r.ok) setMensagem(r.erro); else { setMensagem("Condições formalizadas registradas."); router.refresh(); } } catch { setMensagem("Não foi possível registrar as condições. Confira o histórico antes de repetir."); } }); }}><h2 className="text-xl">Registrar condições formalizadas</h2><p>O registro preserva a vigência formalizada. Ele não executa acertos nem cria ou altera cobranças.</p>{mensagem && <p role="alert">{mensagem}</p>}<button className="rounded border px-4 py-2" disabled={pendente}>{pendente ? "Registrando…" : "Registrar condições formalizadas"}</button></form>;
}
