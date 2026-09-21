import { randomUUID } from "node:crypto";
import { Prisma, type Prisma as PrismaTypes } from "@prisma/client";
import { z } from "zod";
import { ErroRegra, registrarEvento } from "@/server/_shared";
import { bloquearLancamento } from "./lancamento-tx";
import { conferirGestorAvaliacao } from "./regras-tx";

export const ConfirmarResolucaoImpedimentoSchema = z.object({
  reservaImpedidaId: z.string().min(1).max(100),
  realizacaoId: z.string().min(1).max(100),
  motivo: z.string().trim().min(5).max(2000),
  chaveIdempotencia: z.string().trim().min(8).max(100),
}).strict();

type Linha = { id: string; status: string; matriculaId: string; regraId: string; codigoAvaliacao: string; alocacaoId: string; turmaId: string };

/**
 * Q164: a gestão pedagógica confirma que o impedimento causado pela escola foi resolvido
 * por uma realização posterior da MESMA avaliação, já com nota oficial. A reserva impedida
 * e sua ocorrência continuam como histórico; rascunho, rejeição, nota de outro contrato ou
 * de outra avaliação não resolvem. O guard do banco repete estas invariantes.
 */
export async function confirmarResolucaoImpedimentoSegundaChamadaTx(tx: PrismaTypes.TransactionClient, autorId: string, input: z.input<typeof ConfirmarResolucaoImpedimentoSchema>) {
  const d = ConfirmarResolucaoImpedimentoSchema.parse(input);
  const [impedida] = await tx.$queryRaw<Linha[]>(Prisma.sql`
    SELECT r.id,r.status,r."matriculaId" AS "matriculaId",r."regraId" AS "regraId",r."codigoAvaliacao" AS "codigoAvaliacao",p."alocacaoId" AS "alocacaoId",p."turmaId" AS "turmaId"
    FROM "ReservaSegundaChamada" r JOIN "PropostaSegundaChamada" p ON p.id=r."propostaId" WHERE r.id=${d.reservaImpedidaId} FOR UPDATE OF r`);
  if (!impedida) throw new ErroRegra("Reserva de segunda chamada não encontrada.");
  await bloquearLancamento(tx, impedida.alocacaoId); await conferirGestorAvaliacao(tx, autorId);

  const anterior = await tx.resolucaoImpedimentoSegundaChamada.findUnique({ where: { reservaImpedidaId: impedida.id } });
  if (anterior) {
    if (anterior.confirmadaPorId === autorId && anterior.chaveIdempotencia === d.chaveIdempotencia && anterior.realizacaoId === d.realizacaoId && anterior.motivo === d.motivo) return { id: anterior.id, nova: false };
    throw new ErroRegra("O impedimento desta reserva já possui resolução confirmada.");
  }
  if (impedida.status !== "PENDENCIA_ESCOLA") throw new ErroRegra("A reserva não possui impedimento causado pela escola.");

  const realizacao = await tx.realizacaoSegundaChamada.findUnique({ where: { id: d.realizacaoId }, select: { id: true, realizadaEm: true,
    reserva: { select: { id: true, matriculaId: true, regraId: true, codigoAvaliacao: true, proposta: { select: { alocacaoId: true, turmaId: true } } } },
    lancamentosOriginais: { where: { decisao: { is: { aprovada: true } } }, select: { id: true }, take: 1 } } });
  const mesma = realizacao && realizacao.reserva.id !== impedida.id && realizacao.reserva.matriculaId === impedida.matriculaId && realizacao.reserva.regraId === impedida.regraId
    && realizacao.reserva.codigoAvaliacao === impedida.codigoAvaliacao && realizacao.reserva.proposta.alocacaoId === impedida.alocacaoId && realizacao.reserva.proposta.turmaId === impedida.turmaId;
  if (!realizacao || !mesma) throw new ErroRegra("A realização informada não pertence à mesma avaliação desta matrícula.");
  const impedimento = await tx.ocorrenciaSegundaChamada.findFirst({ where: { reservaId: impedida.id, status: "PENDENCIA_ESCOLA" }, orderBy: [{ ocorridaEm: "desc" }, { id: "desc" }], select: { ocorridaEm: true } });
  if (!impedimento || realizacao.realizadaEm <= impedimento.ocorridaEm) throw new ErroRegra("A realização precisa ser posterior ao impedimento registrado.");
  if (!realizacao.lancamentosOriginais.length) throw new ErroRegra("A realização ainda não possui nota oficial. Oficialize o lançamento antes de confirmar a resolução.");

  const id = randomUUID();
  await tx.resolucaoImpedimentoSegundaChamada.create({ data: { id, reservaImpedidaId: impedida.id, realizacaoId: realizacao.id, confirmadaPorId: autorId, motivo: d.motivo, chaveIdempotencia: d.chaveIdempotencia } });
  await registrarEvento(tx, { tipo: "SegundaChamadaImpedimentoResolvido", agregadoTipo: "Matricula", agregadoId: impedida.matriculaId, autorId,
    payload: { resolucaoId: id, reservaImpedidaId: impedida.id, realizacaoId: realizacao.id, lancamentoOficialId: realizacao.lancamentosOriginais[0]!.id } });
  return { id, nova: true };
}
