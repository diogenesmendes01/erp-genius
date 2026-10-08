"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { prepararProcessoAssinaturaAditivo } from "@/server/contratos/aditivo-envio";
import { botaoClasses } from "@/components/Botao";
import { FeedbackAcao } from "@/components/FeedbackAcao";
import { useAcaoCliente } from "@/lib/acao-cliente";

export function ProcessoFormulario({ matriculaId, propostaId, artefatoId, conferenciaId, ambiente }: {
  matriculaId: string; propostaId: string; artefatoId: string; conferenciaId: string; ambiente: "SANDBOX" | "PRODUCAO";
}) {
  // Sem chave de idempotência: na falha de transporte, conferir antes de repetir (MSG_RESULTADO_INCERTO_SEM_CHAVE).
  const router = useRouter(), acao = useAcaoCliente({ idempotente: false }), [fornecedor, setFornecedor] = useState("");
  return <form className="space-y-3 rounded border p-4" onSubmit={async event => { event.preventDefault(); if (fornecedor !== "ZAPSIGN" && fornecedor !== "CLICKSIGN" && fornecedor !== "DOCUSIGN") { acao.limpar(); acao.setErro("Selecione o fornecedor."); return; }
    const d = await acao.executar(() => prepararProcessoAssinaturaAditivo({ matriculaId, propostaId, artefatoId, conferenciaId, fornecedor, ambiente }), "Processo preparado internamente.");
    if (d?.tipo === "ok") router.refresh();
  }}>
    <h2 className="text-xl">Preparar processo de assinatura</h2>
    <p>Esta preparação não envia o documento ao fornecedor e não conclui assinaturas.</p>
    <div><label htmlFor="fornecedor-aditivo">Fornecedor</label><select id="fornecedor-aditivo" className="mt-1 block rounded border p-2" value={fornecedor} onChange={event => setFornecedor(event.target.value)} required disabled={acao.ocupado}><option value="">Selecione o fornecedor</option><option value="ZAPSIGN">ZapSign</option><option value="CLICKSIGN">Clicksign</option><option value="DOCUSIGN">DocuSign</option></select></div>
    <div><span className="font-medium">Ambiente da fonte</span><p>{ambiente === "PRODUCAO" ? "Produção" : "Sandbox"}</p></div>
    <FeedbackAcao erro={acao.erro} sucesso={acao.sucesso} /><button className={botaoClasses({ variante: "secundario", tamanho: "lg" })} disabled={acao.ocupado}>{acao.ocupado ? "Preparando…" : "Preparar processo de assinatura"}</button>
  </form>;
}
