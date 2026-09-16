"use client";
import { useState, useTransition } from "react";
import { decidirAlteracaoQuantidadeAulasModalidade } from "@/server/agenda/modalidade-quantidade";
export function DecidirQuantidadeAulas({ propostaId }: { propostaId: string }) {
 const [motivo, setMotivo] = useState(""), [erro, setErro] = useState<string | null>(null), [pendente, start] = useTransition();
 const decidir = (aprovar: boolean) => start(async () => { const r = await decidirAlteracaoQuantidadeAulasModalidade({ propostaId, aprovar, motivo }); if (!r.ok) setErro(r.erro); else window.location.reload(); });
 return <section className="space-y-3 rounded border p-4"><h2 className="font-medium">Decisão independente</h2><p className="text-sm text-gray-600">A aprovação aplica o conjunto completo nesta mesma operação.</p><label className="block">Motivo<input className="ml-2 w-96 rounded border px-2 py-1" value={motivo} onChange={(e) => setMotivo(e.target.value)} /></label>{erro && <p role="alert">{erro}</p>}<button className="mr-2 rounded bg-brand-700 px-3 py-2 text-white" disabled={pendente || motivo.trim().length < 5} onClick={() => decidir(true)}>Aprovar e aplicar</button><button className="rounded border px-3 py-2" disabled={pendente || motivo.trim().length < 5} onClick={() => decidir(false)}>Rejeitar</button></section>;
}
