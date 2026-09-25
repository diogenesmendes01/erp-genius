"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { decidirEAplicarReplanejamentoConjunto } from "@/server/agenda/replanejamento-decisao";
import { formatarInstanteExibicao } from "@/server/operacao/fuso-exibicao";
import { FeedbackAcao } from "@/components/FeedbackAcao";
import { useAcaoCliente } from "@/lib/acao-cliente";
import { botaoClasses } from "@/components/Botao";
import { CampoTexto } from "@/components/CampoTexto";

type Excecao = { encontroId: string; codigo: string | null; inicio: string; fusoOrigem: string | null; motivoProposto: string | null };
export function DecidirReplanejamento({ calendarioId, revisaoId, podeAprovar, podeRejeitar, excecoes, preferenciaFusoExibicao = null }: { calendarioId: string; revisaoId: string; podeAprovar: boolean; podeRejeitar: boolean; excecoes: Excecao[]; preferenciaFusoExibicao?: string | null }) {
 // Decisão sem chave de idempotência no contrato (server/agenda/replanejamento-decisao.ts:18): a falha não manda reenviar.
 const router = useRouter(), [motivo, setMotivo] = useState(""), [autorizar, setAutorizar] = useState<string[]>([]), acao = useAcaoCliente({ idempotente: false }), pendente = acao.ocupado;
 const enviar = async (aprovar: boolean) => { const d = await acao.executar(() => decidirEAplicarReplanejamentoConjunto({ calendarioId, revisaoId, aprovar, motivo, excecoesAutorizadas: aprovar ? autorizar : [] })); if (d?.tipo === "ok") router.refresh(); };
 return <form className="space-y-3" action={(f) => { const acao = f.get("acao"); enviar(acao === "aprovar"); }}>
   <label className="block">Motivo da decisão<CampoTexto required minLength={5} maxLength={2000} value={motivo} onChange={(e) => setMotivo(e.target.value)} className="mt-1 block w-full rounded border p-2" disabled={pendente} /></label>
   {excecoes.map((e) => { const origem = e.fusoOrigem ?? "UTC", exibicao = formatarInstanteExibicao(e.inicio, preferenciaFusoExibicao, origem); return <label className="flex gap-2" key={e.encontroId}><input type="checkbox" disabled={pendente || !e.motivoProposto} checked={autorizar.includes(e.encontroId)} onChange={(x) => setAutorizar((v) => x.target.checked ? [...v, e.encontroId] : v.filter((id) => id !== e.encontroId))} />Autorizar exceção de {e.codigo ?? "turma identificada"} em {exibicao.texto} ({exibicao.fuso}; origem {origem}){e.motivoProposto ? `: ${e.motivoProposto}` : " (sem justificativa)"}</label>; })}
   <FeedbackAcao erro={acao.erro} />
   {(podeAprovar || podeRejeitar) ? <div className="flex gap-2">{podeAprovar && <button name="acao" value="aprovar" disabled={pendente} className={botaoClasses({ tamanho: "lg" })}>{pendente ? "Registrando…" : "Aprovar e aplicar conjunto"}</button>}{podeRejeitar && <button name="acao" value="rejeitar" disabled={pendente} className={botaoClasses({ variante: "secundario", tamanho: "lg" })}>Rejeitar revisão</button>}</div> : <p>Esta pessoa não pode decidir o conjunto na situação atual.</p>}
 </form>;
}
