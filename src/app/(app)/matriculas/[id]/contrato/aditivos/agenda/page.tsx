import Link from "next/link";
import { Papel } from "@prisma/client";
import { exigirSessaoPagina } from "@/server/_shared";
import { consultarOpcoesConferenciaAgendaAditivo } from "@/server/contratos/agenda-aditivo";
import { ConferenciaAgendaFormulario } from "./ConferenciaAgendaFormulario";

export default async function ConferenciaAgendaPage({ params }: { params: Promise<{ id: string }> }) {
  await exigirSessaoPagina(Papel.SECRETARIA_ACADEMICA, Papel.ADMINISTRADOR, Papel.GERENTE_PEDAGOGICO);
  const { id } = await params, r = await consultarOpcoesConferenciaAgendaAditivo({ matriculaId: id });
  if (!r.ok || !r.dado) return <p role="alert">{r.ok ? "Consulta indisponível." : r.erro}</p>;
  return <div className="space-y-5"><Link className="underline" href="/alunos">Voltar a alunos</Link><h1 className="text-2xl">Agenda do aditivo · {r.dado.matricula.aluno}</h1><p>Compare os horários atuais com a alteração proposta antes de qualquer fluxo posterior. Esta tela não aprova, não gera contrato e não altera a agenda.</p><ConferenciaAgendaFormulario matriculaId={id} encontros={r.dado.encontros} professores={r.dado.professores} /></div>;
}
