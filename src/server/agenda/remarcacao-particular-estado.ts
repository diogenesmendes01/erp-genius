import { Prisma } from "@prisma/client";
import { z } from "zod";
import { ErroRegra } from "@/server/_shared";
import { instanteDaGrade } from "./grade";
import { DataCivilSchema } from "@/server/matricula/cobertura";
import { FusoInstitucionalSchema } from "@/server/operacao/fuso";
import { PeriodosCalendarioSchema } from "./calendario-schema";
import { conferirDiasNaoLetivos } from "./calendario-intervalo";
export const RemarcacaoEntrada = z.object({ encontroOriginalId: z.string().min(1), professorId: z.string().min(1), data: DataCivilSchema,
  horario: z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/), fuso: FusoInstitucionalSchema,
  evidenciaEscolha: z.string().trim().min(5).max(2000), motivo: z.string().trim().min(5).max(2000),
  motivoExcecaoNaoLetiva: z.string().trim().min(5).max(2000).optional(), chaveIdempotencia: z.string().min(8).max(100) }).strict();

/** Deve ser chamado dentro do bloqueio de calendário e matrícula; não publica nem reserva horas. */
export async function conferirRemarcacaoParticularTx(tx: Prisma.TransactionClient, d: z.infer<typeof RemarcacaoEntrada>) {
  const e = await tx.encontroAgenda.findUnique({ where: { id: d.encontroOriginalId }, include: { matricula: { select: { status: true } }, diario: { select: { id: true } }, reservasHoras: { include: { consumo: true, decisoesLiberacao: { where: { aprovada: true }, include: { proposta: { select: { destino: true } } } } } } } });
  if (!e?.matriculaId || e.finalidade !== "AULA" || e.turmaId || e.status !== "CANCELADO" || e.matricula?.status !== "ATIVA") throw new ErroRegra("Exige particular cancelada e matrícula ativa.");
  if (e.diario || e.reservasHoras.some(r => r.consumo)) throw new ErroRegra("Regularize diário e consumo antes da remarcação.");
  if (e.reservasHoras.some(r => r.decisoesLiberacao.some(d => d.proposta.destino === "CREDITO"))) throw new ErroRegra("Horas convertidas em crédito não autorizam remarcação deste encontro.");
  const cancelamento = await tx.decisaoCancelamentoParticular.findFirst({ where: { aprovada: true, proposta: { encontroId: e.id } }, orderBy: { decididaEm: "desc" } });
  if (!cancelamento) throw new ErroRegra("O cancelamento da escola precisa estar aprovado.");
  const duracao = e.fim.getTime() - e.inicio.getTime();
  if (duracao <= 0 || duracao > 86400000) throw new ErroRegra("Confira a duração contratada antes de remarcar.");
  const inicio = instanteDaGrade(d.data, d.horario, d.fuso), fim = new Date(inicio.getTime() + duracao);
  if (inicio <= new Date()) throw new ErroRegra("Escolha um encontro futuro.");
  await tx.$queryRaw`SELECT id FROM "Usuario" WHERE id = ${d.professorId} FOR SHARE`;
  const professor = await tx.usuario.findUnique({ where: { id: d.professorId }, select: { ativo: true, papeis: true, nome: true } });
  const calendario = await tx.versaoCalendarioEscolar.findFirst({ where: { decisao: { aprovada: true } }, orderBy: { versao: "desc" } });
  await tx.$queryRaw`SELECT id FROM "ConfiguracaoOperacional" WHERE id = 'escola' FOR SHARE`;
  const config = await tx.configuracaoOperacional.findUnique({ where: { id: "escola" }, select: { fusoInstitucional: true } });
  if (!calendario || config?.fusoInstitucional !== calendario.fusoInstitucional) throw new ErroRegra("Confira calendário aprovado e fuso institucional.");
  const periodos = conferirDiasNaoLetivos({ inicio: inicio.toISOString(), fim: fim.toISOString(), fusoEscola: calendario.fusoInstitucional, periodos: PeriodosCalendarioSchema.parse(calendario.periodos).map(({ id, inicio, fim }) => ({ id, inicio, fim })) }).periodosAfetados;
  const conflitos = await tx.encontroAgenda.count({ where: { status: { in: ["PREVISTO", "MINISTRADO"] }, inicio: { lt: fim }, fim: { gt: inicio }, OR: [{ professorId: d.professorId }, { matriculaId: e.matriculaId }] } });
  const indisponibilidades = await tx.indisponibilidadeDocente.count({ where: { professorId: d.professorId, decisao: { aprovada: true }, inicio: { lt: fim }, fim: { gt: inicio } } });
  const reservasComerciais = await tx.horarioReservaParticular.count({ where: { professorId: d.professorId, reserva: { status: { in: ["ATIVA", "MANTIDA_PENDENCIA"] } }, inicio: { lt: fim }, fim: { gt: inicio } } });
  const pendencias: string[] = [];
  if (!professor?.ativo || !professor.papeis.includes("PROFESSOR")) pendencias.push("Defina professor ativo.");
  if (conflitos || indisponibilidades || reservasComerciais) pendencias.push("Resolva conflitos, indisponibilidades e reservas comerciais do horário.");
  if (e.reservasHoras.some(r => !r.decisoesLiberacao.length)) pendencias.push("Financeiro precisa aprovar a liberação das horas da reserva original para remarcação.");
  if (periodos.length && !d.motivoExcecaoNaoLetiva) pendencias.push("O intervalo atinge dia não letivo; justifique a exceção específica para aprovação.");
  return { matriculaId: e.matriculaId, cancelamentoId: cancelamento.id, inicio: inicio.toISOString(), fim: fim.toISOString(), fuso: d.fuso, professorId: d.professorId,
    professorNome: professor?.nome ?? "Professor indisponível", calendarioId: calendario.id, calendarioVersao: calendario.versao, periodosNaoLetivos: periodos,
    origem: { id: e.id, inicio: e.inicio.toISOString(), fim: e.fim.toISOString(), professorId: e.professorId }, pendencias };
}
