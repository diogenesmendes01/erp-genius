"use client";
import { useRouter } from "next/navigation";
import { registrarConferenciaFinalAditivo } from "@/server/contratos/aditivo-conferencia-final";
import { botaoClasses } from "@/components/Botao";
import { FeedbackAcao } from "@/components/FeedbackAcao";
import { useAcaoCliente } from "@/lib/acao-cliente";
import { CampoTexto } from "@/components/CampoTexto";
export function ConferenciaFinalFormulario({ matriculaId, propostaId, conclusaoId, revisaoHash }: { matriculaId: string; propostaId: string; conclusaoId: string; revisaoHash: string }) {
  // Sem chave de idempotência: na falha de transporte, conferir antes de repetir (MSG_RESULTADO_INCERTO_SEM_CHAVE).
  const router = useRouter(), acao = useAcaoCliente({ idempotente: false });
  return <form className="space-y-3 rounded border p-4" onSubmit={async event => { event.preventDefault(); const d = new FormData(event.currentTarget); if (d.get("documento") !== "on" || d.get("evidencias") !== "on") { acao.limpar(); acao.setErro("Confirme o documento e as evidências preservadas."); return; } const desfecho = await acao.executar(() => registrarConferenciaFinalAditivo({ matriculaId, propostaId, conclusaoId, revisaoHash, documentoConferido: true, evidenciasConferidas: true, motivo: String(d.get("motivo") ?? "") }), "Conferência interna registrada."); if (desfecho?.tipo === "ok") router.refresh(); }}>
    <h2 className="text-xl">Conferência final interna</h2><p>Esta conferência não aplica condições novas nem altera a matrícula.</p>
    <label className="block"><input type="checkbox" name="documento" disabled={acao.ocupado} /> Conferi o PDF assinado preservado.</label><label className="block"><input type="checkbox" name="evidencias" disabled={acao.ocupado} /> Conferi as evidências preservadas.</label>
    <label className="block">Motivo<CampoTexto className="mt-1 block w-full rounded border p-2" name="motivo" minLength={5} maxLength={2000} required disabled={acao.ocupado} /></label><FeedbackAcao erro={acao.erro} sucesso={acao.sucesso} /><button className={botaoClasses({ variante: "secundario", tamanho: "lg" })} disabled={acao.ocupado}>{acao.ocupado ? "Registrando…" : "Registrar conferência interna"}</button>
  </form>;
}
