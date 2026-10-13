"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { decidirAlteracaoQuantidadeAulasModalidade } from "@/server/agenda/modalidade-quantidade";
import { FeedbackAcao } from "@/components/FeedbackAcao";
import { ConfirmarAcao } from "@/components/ConfirmarAcao";
import { useAcaoCliente } from "@/lib/acao-cliente";
import { botaoClasses } from "@/components/Botao";
/** O que a aprovação aplica: a modalidade, a quantidade antes → depois e as turmas impactadas. */
export type ResumoQuantidadeAulas = { modalidade: string; quantidadeAnterior: number; quantidadeNova: number; turmas: number };
const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`;
export function DecidirQuantidadeAulas({ propostaId, resumo }: { propostaId: string; resumo: ResumoQuantidadeAulas }) {
 // Decisão sem chave de idempotência no contrato (server/agenda/modalidade-quantidade.ts:60): a falha não manda reenviar.
 const router = useRouter();
 const [motivo, setMotivo] = useState(""), acao = useAcaoCliente({ idempotente: false }), pendente = acao.ocupado;
 // Aprovar aplica o conjunto completo na mesma transação (situação APLICADA) e muda a quantidade de aulas de TODAS as
 // turmas impactadas (docs/42 L1218): o botão só abre a confirmação, que repete a mudança e o número de turmas e exige
 // "Conferi as {n} turmas impactadas"; a action roda no ConfirmarAcao. Rejeitar só encerra a proposta (REJEITADA).
 const [confirmando, setConfirmando] = useState(false);
 const rejeitar = async () => { const d = await acao.executar(() => decidirAlteracaoQuantidadeAulasModalidade({ propostaId, aprovar: false, motivo }), "Proposta rejeitada."); if (d?.tipo === "ok") router.refresh(); };
 const pedirAprovacao = () => { acao.limpar(); setConfirmando(true); };
 const aprovada = () => { setConfirmando(false); acao.setSucesso("Alteração aprovada e aplicada."); router.refresh(); };
 const turmas = plural(resumo.turmas, "turma impactada", "turmas impactadas");
 return <section className="space-y-3 rounded border p-4"><h2 className="font-medium">Decisão independente</h2><p className="text-sm text-gray-600">A aprovação aplica o conjunto completo nesta mesma operação.</p><label className="block">Motivo<input className="ml-2 w-96 rounded border px-2 py-1" value={motivo} onChange={(e) => setMotivo(e.target.value)} /></label><FeedbackAcao erro={acao.erro} sucesso={acao.sucesso} /><button className={`${botaoClasses({ tamanho: "lg" })} mr-2`} disabled={pendente || confirmando || motivo.trim().length < 5} onClick={pedirAprovacao}>Aprovar e aplicar</button><button className={botaoClasses({ variante: "perigo", tamanho: "lg" })} disabled={pendente || confirmando || motivo.trim().length < 5} onClick={rejeitar}>Rejeitar</button>
  {confirmando && <ConfirmarAcao
   titulo={`Aprovar e aplicar a nova quantidade de aulas de ${resumo.modalidade}?`}
   confirmacao="aprovação da quantidade"
   conferencia={resumo.turmas === 1 ? "Conferi a turma impactada." : `Conferi as ${turmas}.`}
   idempotente={false}
   acao={() => decidirAlteracaoQuantidadeAulasModalidade({ propostaId, aprovar: true, motivo })}
   aoConcluir={aprovada}
   aoCancelar={() => setConfirmando(false)}
  >
   <p>A quantidade de aulas passa de {resumo.quantidadeAnterior} para {resumo.quantidadeNova} em {turmas} de uma vez, nesta mesma operação.</p>
   <p>Motivo registrado: {motivo.trim()}</p>
   <p>Não há desfazer pela tela: para voltar atrás, é preciso preparar e aprovar outra proposta.</p>
  </ConfirmarAcao>}
 </section>;
}
