"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { decidirEAplicarReplanejamentoConjunto } from "@/server/agenda/replanejamento-decisao";
import { formatarInstanteExibicao } from "@/server/operacao/fuso-exibicao";
import { FeedbackAcao } from "@/components/FeedbackAcao";
import { useAcaoCliente } from "@/lib/acao-cliente";
import { botaoClasses } from "@/components/Botao";
import { CampoTexto } from "@/components/CampoTexto";
import { ConfirmarAcao } from "@/components/ConfirmarAcao";

type Excecao = { encontroId: string; codigo: string | null; inicio: string; fusoOrigem: string | null; motivoProposto: string | null };
/** O tamanho do conjunto, contado na conferência registrada da revisão: turmas e encontros que mudam de data. */
export type ResumoReplanejamento = { turmas: number; encontros: number };
const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`;
export function DecidirReplanejamento({ calendarioId, revisaoId, podeAprovar, podeRejeitar, excecoes, resumo, preferenciaFusoExibicao = null }: { calendarioId: string; revisaoId: string; podeAprovar: boolean; podeRejeitar: boolean; excecoes: Excecao[]; resumo: ResumoReplanejamento; preferenciaFusoExibicao?: string | null }) {
 // Decisão sem chave de idempotência no contrato (server/agenda/replanejamento-decisao.ts:18): a falha não manda reenviar.
 const router = useRouter(), [motivo, setMotivo] = useState(""), [autorizar, setAutorizar] = useState<string[]>([]), acao = useAcaoCliente({ idempotente: false }), pendente = acao.ocupado;
 // Aprovar reescreve as datas dos encontros previstos de todas as turmas do conjunto (docs/42 L1102): o botão só
 // abre a confirmação, que repete turmas, encontros e exceções autorizadas e pede "Conferi…"; a action roda no
 // ConfirmarAcao. Rejeitar só encerra a revisão, sem mexer na agenda, e continua direto.
 const [confirmando, setConfirmando] = useState(false);
 const rejeitar = async () => { const d = await acao.executar(() => decidirEAplicarReplanejamentoConjunto({ calendarioId, revisaoId, aprovar: false, motivo, excecoesAutorizadas: [] })); if (d?.tipo === "ok") router.refresh(); };
 const pedirAprovacao = () => { acao.limpar(); setConfirmando(true); };
 const aprovado = () => { setConfirmando(false); router.refresh(); };
 const data = (e: Excecao) => { const origem = e.fusoOrigem ?? "UTC", exibicao = formatarInstanteExibicao(e.inicio, preferenciaFusoExibicao, origem); return `${exibicao.texto} (${exibicao.fuso}; origem ${origem})`; };
 const autorizadas = excecoes.filter((e) => autorizar.includes(e.encontroId));
 return <form className="space-y-3" action={(f) => { if (f.get("acao") === "aprovar") pedirAprovacao(); else void rejeitar(); }}>
   <label className="block">Motivo da decisão<CampoTexto required minLength={5} maxLength={2000} value={motivo} onChange={(e) => setMotivo(e.target.value)} className="mt-1 block w-full rounded border p-2" disabled={pendente} /></label>
   {excecoes.map((e) => { const origem = e.fusoOrigem ?? "UTC", exibicao = formatarInstanteExibicao(e.inicio, preferenciaFusoExibicao, origem); return <label className="flex gap-2" key={e.encontroId}><input type="checkbox" disabled={pendente || !e.motivoProposto} checked={autorizar.includes(e.encontroId)} onChange={(x) => setAutorizar((v) => x.target.checked ? [...v, e.encontroId] : v.filter((id) => id !== e.encontroId))} />Autorizar exceção de {e.codigo ?? "turma identificada"} em {exibicao.texto} ({exibicao.fuso}; origem {origem}){e.motivoProposto ? `: ${e.motivoProposto}` : " (sem justificativa)"}</label>; })}
   <FeedbackAcao erro={acao.erro} />
   {(podeAprovar || podeRejeitar) ? <div className="flex gap-2">{podeAprovar && <button name="acao" value="aprovar" disabled={pendente} className={botaoClasses({ tamanho: "lg" })}>{pendente ? "Registrando…" : "Aprovar e aplicar conjunto"}</button>}{podeRejeitar && <button name="acao" value="rejeitar" disabled={pendente} className={botaoClasses({ variante: "perigo", tamanho: "lg" })}>Rejeitar revisão</button>}</div> : <p>Esta pessoa não pode decidir o conjunto na situação atual.</p>}
   {confirmando && <ConfirmarAcao
     titulo="Aprovar e aplicar o conjunto de novas datas?"
     confirmacao="aprovação do conjunto"
     conferencia="Conferi as datas, os conflitos e as exceções deste conjunto."
     idempotente={false}
     acao={() => decidirEAplicarReplanejamentoConjunto({ calendarioId, revisaoId, aprovar: true, motivo, excecoesAutorizadas: autorizar })}
     aoConcluir={aprovado}
     aoCancelar={() => setConfirmando(false)}
   >
     <p>As datas propostas substituem as atuais na agenda: {plural(resumo.turmas, "turma", "turmas")}, {plural(resumo.encontros, "encontro previsto muda", "encontros previstos mudam")} de data ou horário.</p>
     {autorizadas.length ? <><p>{plural(autorizadas.length, "exceção de dia não letivo autorizada", "exceções de dia não letivo autorizadas")}:</p><ul className="list-disc pl-5">{autorizadas.map((e) => <li key={e.encontroId}>{e.codigo ?? "turma identificada"} em {data(e)}</li>)}</ul></> : <p>Nenhuma exceção de dia não letivo autorizada.</p>}
     <p>Motivo registrado: {motivo.trim()}</p>
     <p>Não há desfazer pela tela: para voltar atrás, é preciso preparar e aprovar outra revisão.</p>
   </ConfirmarAcao>}
 </form>;
}
