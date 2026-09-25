"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { aplicarCondicoesFormalizadasAditivo, formalizarEAplicarCondicoesAditivo } from "@/server/contratos/aditivo-condicoes";
import { botaoClasses } from "@/components/Botao";
import { MSG_RESULTADO_INCERTO } from "@/lib/mensagens";

export function CondicoesFormalizadasFormulario({ matriculaId, propostaId, conclusaoId, revisaoHash, formalizada = false }: { matriculaId: string; propostaId: string; conclusaoId: string; revisaoHash: string; formalizada?: boolean }) {
  const router = useRouter(), [pendente, iniciar] = useTransition(), [mensagem, setMensagem] = useState(""), [chave] = useState(() => crypto.randomUUID());
  const titulo = formalizada ? "Regularizar aplicação das condições" : "Formalizar e aplicar condições";
  const explicar = formalizada ? "Esta versão já foi formalizada, mas ainda não vale para novos cálculos. A regularização confere novamente os documentos, aprovações, assinaturas e conferência final; não cria fatos retroativos." : "A ação registra a formalização e a aplicação das condições. Ela não cria cobrança, acerto, matrícula nem agenda.";
  return <form className="space-y-3 rounded border p-4" onSubmit={event => { event.preventDefault(); iniciar(async () => { try { const entrada = { matriculaId, propostaId, conclusaoId, revisaoHash, chaveIdempotencia: chave }; const r = formalizada ? await aplicarCondicoesFormalizadasAditivo(entrada) : await formalizarEAplicarCondicoesAditivo(entrada); if (!r.ok) setMensagem(r.erro); else { setMensagem("Condições aplicadas na vigência indicada. Cobranças já emitidas foram preservadas."); router.refresh(); } } catch { setMensagem(MSG_RESULTADO_INCERTO); } }); }}><h2 className="text-xl">{titulo}</h2><p>{explicar}</p>{mensagem && <p role="alert">{mensagem}</p>}<button className={botaoClasses({ variante: "secundario", tamanho: "lg" })} disabled={pendente}>{pendente ? "Registrando…" : titulo}</button></form>;
}
