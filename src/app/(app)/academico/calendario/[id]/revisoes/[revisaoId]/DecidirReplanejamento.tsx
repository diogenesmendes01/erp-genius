"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { decidirEAplicarReplanejamentoConjunto } from "@/server/agenda/replanejamento-decisao";
import { formatarInstanteExibicao } from "@/server/operacao/fuso-exibicao";

type Excecao = { encontroId: string; codigo: string | null; inicio: string; fusoOrigem: string | null; motivoProposto: string | null };
export function DecidirReplanejamento({ calendarioId, revisaoId, podeAprovar, podeRejeitar, excecoes, preferenciaFusoExibicao = null }: { calendarioId: string; revisaoId: string; podeAprovar: boolean; podeRejeitar: boolean; excecoes: Excecao[]; preferenciaFusoExibicao?: string | null }) {
 const router = useRouter(), [motivo, setMotivo] = useState(""), [autorizar, setAutorizar] = useState<string[]>([]), [erro, setErro] = useState<string | null>(null), [pendente, iniciar] = useTransition();
 const enviar = (aprovar: boolean) => iniciar(async () => { setErro(null); const r = await decidirEAplicarReplanejamentoConjunto({ calendarioId, revisaoId, aprovar, motivo, excecoesAutorizadas: aprovar ? autorizar : [] }); if (!r.ok) setErro(r.erro); else router.refresh(); });
 return <form className="space-y-3" action={(f) => { const acao = f.get("acao"); enviar(acao === "aprovar"); }}>
   <label className="block">Motivo da decisão<textarea required minLength={5} maxLength={2000} value={motivo} onChange={(e) => setMotivo(e.target.value)} className="mt-1 block w-full rounded border p-2" disabled={pendente} /></label>
   {excecoes.map((e) => { const origem = e.fusoOrigem ?? "UTC", exibicao = formatarInstanteExibicao(e.inicio, preferenciaFusoExibicao, origem); return <label className="flex gap-2" key={e.encontroId}><input type="checkbox" disabled={pendente || !e.motivoProposto} checked={autorizar.includes(e.encontroId)} onChange={(x) => setAutorizar((v) => x.target.checked ? [...v, e.encontroId] : v.filter((id) => id !== e.encontroId))} />Autorizar exceção de {e.codigo ?? "turma identificada"} em {exibicao.texto} ({exibicao.fuso}; origem {origem}){e.motivoProposto ? `: ${e.motivoProposto}` : " (sem justificativa)"}</label>; })}
   {erro && <p role="alert">{erro}</p>}
   {(podeAprovar || podeRejeitar) ? <div className="flex gap-2">{podeAprovar && <button name="acao" value="aprovar" disabled={pendente} className="rounded bg-brand-solid px-3 py-2 text-white">{pendente ? "Registrando…" : "Aprovar e aplicar conjunto"}</button>}{podeRejeitar && <button name="acao" value="rejeitar" disabled={pendente} className="rounded border px-3 py-2">Rejeitar revisão</button>}</div> : <p>Esta pessoa não pode decidir o conjunto na situação atual.</p>}
 </form>;
}
