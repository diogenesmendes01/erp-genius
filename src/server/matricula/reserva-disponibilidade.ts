import type { Prisma, Turma } from "@prisma/client";
import { conferirNovaAdmissaoTurma } from "./admissao-turma";
import { carregarJanelaAdmissaoVigente } from "./janela-admissao-tx";
import { conferirConflitosReplanejamento } from "@/server/agenda/replanejamento-conflitos";
export async function conferirTurmaParaReserva(tx: Prisma.TransactionClient, turma: Pick<Turma, "id" | "status" | "capacidade">, reservaDaContratacao?: string) {
  const janela = await carregarJanelaAdmissaoVigente(tx, turma.id);
  if (!janela) return { janela: null, conferencia: { elegivel: false, impedimentos: ["LIMITE_NAO_CONFIGURADO"], vagas: null }, agora: new Date() };
  const agora = new Date();
  const encontros = await tx.encontroAgenda.findMany({ where: { turmaId: turma.id, status: "PREVISTO", inicio: { gt: agora } }, orderBy: { id: "asc" },
    select: { id: true, inicio: true, fim: true, professorId: true, propostaGradeId: true } });
  const publicada = !!encontros.length && await tx.propostaGradeTurma.count({ where: { turmaId: turma.id, decisao: { aprovada: true }, calendario: { decisao: { aprovada: true } } } }) > 0;
  const recursos = await conferirConflitosReplanejamento(tx, encontros.map((e) => ({ encontroId: e.id, turmaId: turma.id, professorId: e.professorId, inicio: e.inicio.toISOString(), fim: e.fim.toISOString() })));
  const ocupacoes = await tx.alocacaoTurma.count({ where: { turmaId: turma.id, ativa: true } });
  // Prazo vencido não libera vaga por inferência: a rotina de expiração deve conferir avanço formal.
  const reservas = await tx.reservaVagaMatricula.count({ where: { turmaId: turma.id, ...(reservaDaContratacao ? { id: { not: reservaDaContratacao } } : {}), status: { in: ["ATIVA", "MANTIDA_PENDENCIA"] } } });
  const conferencia = conferirNovaAdmissaoTurma({ agora, fusoAdmissao: janela.fusoAdmissao, limiteEntrada: janela.limiteEntrada, status: turma.status,
    agendaPublicada: publicada, professorApto: !!encontros.length && !recursos.semDocenteApto.length,
    disponibilidadeConferida: !recursos.internos.length && !recursos.externos.length && !recursos.indisponibilidades.length,
    capacidade: turma.capacidade, ocupacoes, reservasOcupando: reservas });
  return { janela, conferencia, agora };
}
