"use client";
import { useState } from "react";
import { decidirAlteracaoQuantidadeAulasModalidade } from "@/server/agenda/modalidade-quantidade";
import { FeedbackAcao } from "@/components/FeedbackAcao";
import { useAcaoCliente } from "@/lib/acao-cliente";
export function DecidirQuantidadeAulas({ propostaId }: { propostaId: string }) {
 // Decisão sem chave de idempotência no contrato (server/agenda/modalidade-quantidade.ts:60): a falha não manda reenviar.
 const [motivo, setMotivo] = useState(""), acao = useAcaoCliente({ idempotente: false }), pendente = acao.ocupado;
 const decidir = async (aprovar: boolean) => { const d = await acao.executar(() => decidirAlteracaoQuantidadeAulasModalidade({ propostaId, aprovar, motivo })); if (d?.tipo === "ok") window.location.reload(); };
 return <section className="space-y-3 rounded border p-4"><h2 className="font-medium">Decisão independente</h2><p className="text-sm text-gray-600">A aprovação aplica o conjunto completo nesta mesma operação.</p><label className="block">Motivo<input className="ml-2 w-96 rounded border px-2 py-1" value={motivo} onChange={(e) => setMotivo(e.target.value)} /></label><FeedbackAcao erro={acao.erro} /><button className="mr-2 rounded bg-brand-solid px-3 py-2 text-white" disabled={pendente || motivo.trim().length < 5} onClick={() => decidir(true)}>Aprovar e aplicar</button><button className="rounded border px-3 py-2" disabled={pendente || motivo.trim().length < 5} onClick={() => decidir(false)}>Rejeitar</button></section>;
}
