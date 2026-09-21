import { disponibilidadeRecuperacaoTx } from "./disponibilidade-recuperacao-tx";
import { isDeepStrictEqual } from "node:util";
import type { Prisma } from "@prisma/client";
import { ErroRegra } from "@/server/_shared";
import { carregarConsolidadoAvaliacoesTx } from "./consolidado-tx";
import { conferirGestorAvaliacao } from "./regras-tx";
import { prazoRecuperacaoVigente } from "./recuperacao-prazo";
import { docenteAtual } from "@/server/diario/permissoes";
import { PeriodosCalendarioSchema } from "@/server/agenda/calendario-schema";
import { conferirDiasNaoLetivos } from "@/server/agenda/calendario-intervalo";

/** Conferência sob os locks do calendário e contrato. Não cria nem publica encontro.
 * Uma futura aprovação deve repetir esta conferência dentro da transação de aplicação. */
export async function conferirAgendaRecuperacaoTx(tx: Prisma.TransactionClient, autorId: string, d: {
  itemReservaId: string; inicio: Date; fim: Date; fuso: string;
}) {
  const ref = await tx.itemReservaTentativaRecuperacao.findUnique({ where: { id: d.itemReservaId }, select: { reserva: { select: { proposta: { select: { alocacaoId: true } } } } } });
  if (!ref) throw new ErroRegra("Tentativa não encontrada.");
  if (await tx.propostaAgendaRecuperacao.count({ where: { itemReservaId: d.itemReservaId, decisao: { aprovada: true } } })) throw new ErroRegra("Tentativa já possui agenda aprovada; alteração exige revisão própria.");
  const atual = await carregarConsolidadoAvaliacoesTx(tx, autorId, ref.reserva.proposta.alocacaoId, "BASE_PLANO");
  await conferirGestorAvaliacao(tx, autorId);
  const item = await tx.itemReservaTentativaRecuperacao.findUniqueOrThrow({ where: { id: d.itemReservaId }, include: {
    realizacao: true, designacoes: { orderBy: { versao: "desc" }, take: 1 }, reserva: { include: { cancelamento: true, proposta: { include: {
      decisao: true, disponibilizacao: true, matricula: true, alocacao: { include: { turma: { include: { vinculosDocentes: true } } } },
    } } } },
  } });
  const p = item.reserva.proposta, a = p.alocacao, t = a.turma, agora = new Date();
  if (!Number.isFinite(d.inicio.getTime()) || !Number.isFinite(d.fim.getTime()) || d.inicio <= agora || d.fim <= d.inicio) throw new ErroRegra("Informe um intervalo futuro válido para a recuperação.");
  if (item.realizacao || item.reserva.cancelamento) throw new ErroRegra("Tentativa já realizada ou cancelada não pode receber novo agendamento.");
  if (!p.decisao?.aprovada || !p.disponibilizacao) throw new ErroRegra("Confira o plano aprovado e sua disponibilização antes de planejar o horário.");
  if (!a.ativa || p.matricula.status !== "ATIVA" || a.matriculaId !== p.matriculaId || t.nivelId !== p.nivelId || t.regraAvaliacaoId !== p.regraId) throw new ErroRegra("Confira o vínculo e a situação contratual antes de agendar.");
  if (!isDeepStrictEqual(p.snapshot, atual)) throw new ErroRegra("As fontes do plano mudaram. Confira o plano antes de agendar.");
  const prazo = await prazoRecuperacaoVigente(tx, p.disponibilizacao.id);
  if (d.inicio < p.disponibilizacao.disponibilizadaEm || d.inicio >= prazo || d.fim > prazo) throw new ErroRegra("O encontro precisa caber no prazo vigente do plano; prorrogação segue aprovação própria.");
  const professorId = item.designacoes[0]?.professorId ?? (t.professorId && docenteAtual(t.professorId, t) ? t.professorId : null);
  const professor = professorId ? await tx.usuario.findUnique({ where: { id: professorId }, select: { id: true, nome: true, ativo: true, papeis: true } }) : null;
  const pendencias: string[] = [];
  if (!professor?.ativo || !professor.papeis.includes("PROFESSOR")) pendencias.push("Defina um avaliador ativo e autorizado para esta tentativa.");
  const calendario = await tx.versaoCalendarioEscolar.findFirst({ where: { decisao: { aprovada: true } }, orderBy: { versao: "desc" } });
  const config = await tx.configuracaoOperacional.findUnique({ where: { id: "escola" }, select: { fusoInstitucional: true } });
  let diasNaoLetivos: string[] = [];
  if (!calendario) pendencias.push("Publique o calendário institucional antes de aprovar o horário.");
  else {
    if (config?.fusoInstitucional !== calendario.fusoInstitucional) pendencias.push("Confira a divergência entre o fuso institucional e o calendário publicado.");
    diasNaoLetivos = conferirDiasNaoLetivos({ inicio: d.inicio.toISOString(), fim: d.fim.toISOString(), fusoEscola: calendario.fusoInstitucional, periodos: PeriodosCalendarioSchema.parse(calendario.periodos).map(({ id, inicio, fim }) => ({ id, inicio, fim })) }).periodosAfetados;
    if (diasNaoLetivos.length) pendencias.push("O encontro atinge período não letivo e exige exceção específica aprovada.");
  }
  const { encontros, indisponibilidades, reservas } = await disponibilidadeRecuperacaoTx(tx, { alunoId: p.matricula.alunoId, professorId, inicio: d.inicio, fim: d.fim });
  if (encontros.length) pendencias.push("Há encontros publicados que conflitam com a disponibilidade do avaliador ou do aluno.");
  if (indisponibilidades) pendencias.push("O avaliador possui indisponibilidade aprovada no intervalo.");
  if (reservas) pendencias.push("Há horários reservados para contratação no intervalo.");
  return { itemReservaId: item.id, planoId: p.id, planoHash: p.entradaHash, habilidade: item.habilidade, inicio: d.inicio.toISOString(), fim: d.fim.toISOString(), fuso: d.fuso,
    professor: professor ? { id: professor.id, nome: professor.nome } : null, calendarioId: calendario?.id ?? null, prazoAte: prazo.toISOString(),
    diasNaoLetivos, conflitos: encontros.map(e => ({ inicio: e.inicio.toISOString(), fim: e.fim.toISOString(), envolveAvaliador: e.professorId === professorId })),
    indisponibilidades, reservas, pendencias, conferidoEm: agora.toISOString(), publicacaoAutorizada: false as const };
}
