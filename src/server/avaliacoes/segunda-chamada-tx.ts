import { Prisma, type Prisma as PrismaTypes } from "@prisma/client";
import { z } from "zod";
import { bloquearLancamento } from "./lancamento-tx";
import { ConteudoRegraAvaliacaoSchema } from "./regra-schema";

export const EstadoSegundaChamadaSchema = z.object({
  alocacaoId: z.string(), matriculaId: z.string(), turmaId: z.string(), nivelId: z.string(), regraId: z.string(), codigoAvaliacao: z.string(),
  ativa: z.boolean(), statusMatricula: z.string(), pendente: z.boolean(), limiteBase: z.number().int().nonnegative(), extrasAprovados: z.number().int().nonnegative(),
  reservasOcupadas: z.number().int().nonnegative(), autorizacoesAprovadas: z.number().int().nonnegative(), saldo: z.number().int(),
});

/** Estado isolado por matrícula e avaliação. Reserva/consumo não consulta recuperação, particular ou financeiro. */
export async function estadoSegundaChamadaTx(tx: PrismaTypes.TransactionClient, alocacaoId: string, codigoAvaliacao: string) {
  const a = await bloquearLancamento(tx, alocacaoId);
  const turma = await tx.turma.findUniqueOrThrow({ where: { id: a.turmaId }, include: { regraAvaliacao: true } });
  const matricula = await tx.matricula.findUniqueOrThrow({ where: { id: a.matriculaId }, select: { status: true } });
  const regra = turma.regraAvaliacao ? ConteudoRegraAvaliacaoSchema.parse(turma.regraAvaliacao.conteudo) : null;
  const avaliacao = regra?.avaliacoes.find((item) => item.codigo === codigoAvaliacao);
  const oficial = await tx.registroAvaliacaoMatricula.findUnique({ where: { matriculaId_turmaId_codigoAvaliacao: { matriculaId: a.matriculaId, turmaId: a.turmaId, codigoAvaliacao } }, select: { versoes: { where: { decisao: { aprovada: true } }, take: 1, select: { id: true } } } });
  const [contagem] = await tx.$queryRaw<{ autorizacoes: bigint; extras: bigint; ocupadas: bigint }[]>(Prisma.sql`
    SELECT
      (SELECT count(*) FROM "PropostaSegundaChamada" proposta JOIN "DecisaoSegundaChamada" decisao ON decisao."propostaId" = proposta.id AND decisao.aprovada
       WHERE proposta."matriculaId" = ${a.matriculaId} AND proposta."regraId" = ${turma.regraAvaliacaoId} AND proposta."codigoAvaliacao" = ${codigoAvaliacao}) AS autorizacoes,
      (SELECT COALESCE(sum(proposta.quantidade), 0) FROM "PropostaExtraSegundaChamada" proposta JOIN "DecisaoExtraSegundaChamada" decisao ON decisao."propostaId" = proposta.id AND decisao.aprovada
       WHERE proposta."matriculaId" = ${a.matriculaId} AND proposta."regraId" = ${turma.regraAvaliacaoId} AND proposta."codigoAvaliacao" = ${codigoAvaliacao}) AS extras,
      (SELECT count(*) FROM "ReservaSegundaChamada"
       WHERE "matriculaId" = ${a.matriculaId} AND "regraId" = ${turma.regraAvaliacaoId} AND "codigoAvaliacao" = ${codigoAvaliacao}
         AND status IN ('RESERVADA','CONSUMIDA_REALIZACAO','CONSUMIDA_FALTA','CONSUMIDA_CANCELAMENTO_TARDIO')) AS ocupadas
  `);
  const limiteBase = avaliacao?.limiteSegundasChamadas ?? 0, extrasAprovados = Number(contagem?.extras ?? 0), reservasOcupadas = Number(contagem?.ocupadas ?? 0);
  return EstadoSegundaChamadaSchema.parse({ alocacaoId: a.id, matriculaId: a.matriculaId, turmaId: a.turmaId, nivelId: turma.nivelId, regraId: turma.regraAvaliacaoId ?? "", codigoAvaliacao,
    ativa: a.ativa, statusMatricula: matricula.status, pendente: !!avaliacao && !oficial?.versoes.length,
    limiteBase, extrasAprovados, reservasOcupadas, autorizacoesAprovadas: Number(contagem?.autorizacoes ?? 0), saldo: limiteBase + extrasAprovados - reservasOcupadas });
}
