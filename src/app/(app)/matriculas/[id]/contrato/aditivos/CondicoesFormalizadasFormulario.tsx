"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { aplicarCondicoesFormalizadasAditivo, formalizarEAplicarCondicoesAditivo } from "@/server/contratos/aditivo-condicoes";
import { botaoClasses } from "@/components/Botao";
import { FeedbackAcao } from "@/components/FeedbackAcao";
import { useAcaoCliente } from "@/lib/acao-cliente";

export function CondicoesFormalizadasFormulario({ matriculaId, propostaId, conclusaoId, revisaoHash, formalizada = false }: { matriculaId: string; propostaId: string; conclusaoId: string; revisaoHash: string; formalizada?: boolean }) {
  // Chave estável pela vida do formulário: na falha de transporte, reenviar confere a mesma aplicação.
  const router = useRouter(), acao = useAcaoCliente({ idempotente: true }), [chave] = useState(() => crypto.randomUUID());
  const titulo = formalizada ? "Regularizar aplicação das condições" : "Formalizar e aplicar condições";
  const explicar = formalizada ? "Esta versão já foi formalizada, mas ainda não vale para novos cálculos. A regularização confere novamente os documentos, aprovações, assinaturas e conferência final; não cria fatos retroativos." : "A ação registra a formalização e a aplicação das condições. Ela não cria cobrança, acerto, matrícula nem agenda.";
  return <form className="space-y-3 rounded border p-4" onSubmit={async event => { event.preventDefault(); const entrada = { matriculaId, propostaId, conclusaoId, revisaoHash, chaveIdempotencia: chave }; const d = await acao.executar<unknown>(() => formalizada ? aplicarCondicoesFormalizadasAditivo(entrada) : formalizarEAplicarCondicoesAditivo(entrada), "Condições aplicadas na vigência indicada. Cobranças já emitidas foram preservadas."); if (d?.tipo === "ok") router.refresh(); }}><h2 className="text-xl">{titulo}</h2><p>{explicar}</p><FeedbackAcao erro={acao.erro} sucesso={acao.sucesso} /><button className={botaoClasses({ variante: "secundario", tamanho: "lg" })} disabled={acao.ocupado}>{acao.ocupado ? "Registrando…" : titulo}</button></form>;
}
