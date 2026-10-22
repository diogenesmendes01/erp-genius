import { Papel } from "@prisma/client";
import { exigirSessaoPagina } from "@/server/_shared";
import { consultarOpcoesConferenciaAgendaAditivo } from "@/server/contratos/agenda-aditivo";
import { ConferenciaAgendaFormulario } from "./ConferenciaAgendaFormulario";
import { VoltarPara } from "@/components/VoltarPara";
import { MSG_ADITIVO_ORIGEM_HISTORICA_SEM_ASSINATURA } from "@/lib/mensagens";

export default async function ConferenciaAgendaPage({ params }: { params: Promise<{ id: string }> }) {
  await exigirSessaoPagina(Papel.SECRETARIA_ACADEMICA, Papel.ADMINISTRADOR, Papel.GERENTE_PEDAGOGICO);
  const { id } = await params, r = await consultarOpcoesConferenciaAgendaAditivo({ matriculaId: id });
  if (!r.ok || !r.dado) return <p role="alert">{r.ok ? "Consulta indisponível." : r.erro}</p>;
  return <div className="space-y-5"><VoltarPara href="/alunos" /><h1 className="text-2xl">Agenda do aditivo · {r.dado.matricula.aluno}</h1><p>Compare os horários atuais com a alteração proposta antes de qualquer fluxo posterior. Esta tela não aprova, não gera contrato e não altera a agenda.</p>{r.dado.fonteOrigemHistorica && <p role="alert">{MSG_ADITIVO_ORIGEM_HISTORICA_SEM_ASSINATURA} A conferência pode ser feita, mas o registro da proposta de agenda fica suspenso.</p>}<ConferenciaAgendaFormulario matriculaId={id} encontros={r.dado.encontros} professores={r.dado.professores} /></div>;
}
