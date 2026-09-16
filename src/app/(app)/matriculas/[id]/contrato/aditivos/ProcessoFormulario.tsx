"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { prepararProcessoAssinaturaAditivo } from "@/server/contratos/aditivo-envio";

export function ProcessoFormulario({ matriculaId, propostaId, artefatoId, conferenciaId, ambiente }: {
  matriculaId: string; propostaId: string; artefatoId: string; conferenciaId: string; ambiente: "SANDBOX" | "PRODUCAO";
}) {
  const router = useRouter(), [pendente, iniciar] = useTransition(), [mensagem, setMensagem] = useState(""), [fornecedor, setFornecedor] = useState("");
  return <form className="space-y-3 rounded border p-4" onSubmit={event => { event.preventDefault(); if (fornecedor !== "ZAPSIGN" && fornecedor !== "CLICKSIGN" && fornecedor !== "DOCUSIGN") { setMensagem("Selecione o fornecedor."); return; }
    iniciar(async () => { try { const resultado = await prepararProcessoAssinaturaAditivo({ matriculaId, propostaId, artefatoId, conferenciaId, fornecedor, ambiente });
      if (!resultado.ok) setMensagem(resultado.erro); else { setMensagem("Processo preparado internamente."); router.refresh(); }
    } catch { setMensagem("Não foi possível preparar o processo. Confira os registros antes de repetir a tentativa."); } });
  }}>
    <h2 className="text-xl">Preparar processo de assinatura</h2>
    <p>Esta preparação não envia o documento ao fornecedor e não conclui assinaturas.</p>
    <div><label htmlFor="fornecedor-aditivo">Fornecedor</label><select id="fornecedor-aditivo" className="mt-1 block rounded border p-2" value={fornecedor} onChange={event => setFornecedor(event.target.value)} required disabled={pendente}><option value="">Selecione o fornecedor</option><option value="ZAPSIGN">ZapSign</option><option value="CLICKSIGN">Clicksign</option><option value="DOCUSIGN">DocuSign</option></select></div>
    <div><span className="font-medium">Ambiente da fonte</span><p>{ambiente === "PRODUCAO" ? "Produção" : "Sandbox"}</p></div>
    {mensagem && <p role="alert">{mensagem}</p>}<button className="rounded border px-4 py-2" disabled={pendente}>{pendente ? "Preparando…" : "Preparar processo de assinatura"}</button>
  </form>;
}
