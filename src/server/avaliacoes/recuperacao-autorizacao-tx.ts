import { Papel, Prisma } from "@prisma/client";
import { z } from "zod";
import { decidirVigenciaAutorizacaoEspecialRecuperacao } from "./recuperacao-autorizacao-schema";

const Fonte = z.object({ matriculaId: z.string(), alocacaoId: z.string(), regraId: z.string(), propostaId: z.string(),
  propostaHash: z.string(), decisaoId: z.string(), disponibilizacaoId: z.string(), reservaId: z.string(),
  itemReservaId: z.string(), habilidade: z.string(), statusMatricula: z.enum(["PAUSADA", "ENCERRADA"]) }).strict();

/** Resolve exclusivamente uma autorização persistida para a pendência e data informadas. */
export async function carregarAutorizacaoEspecialRecuperacaoTx(tx: Prisma.TransactionClient, itemReservaId: string, realizadaEm: Date) {
  const item = await tx.itemReservaTentativaRecuperacao.findUnique({ where: { id: itemReservaId }, include: {
    reserva: { include: { cancelamento: true, proposta: { include: { decisao: true, disponibilizacao: true, alocacao: true } } } },
  } });
  if (!item || item.reserva.cancelamento) return null;
  const plano = item.reserva.proposta;
  if (!plano.decisao?.aprovada || !plano.disponibilizacao || plano.alocacao.matriculaId !== plano.matriculaId) return null;
  const candidatas = await tx.autorizacaoEspecialRecuperacao.findMany({
    where: { itemReservaId, criadaEm: { lte: realizadaEm }, prazoAte: { gte: realizadaEm } },
    orderBy: [{ criadaEm: "desc" }, { id: "desc" }], include: { autorizador: { select: { ativo: true, papeis: true } } },
  });
  for (const a of candidatas) {
    const fonte = Fonte.safeParse(a.snapshot);
    if (!fonte.success) continue;
    const s = fonte.data;
    if (s.propostaId !== plano.id || s.propostaHash !== plano.entradaHash || s.decisaoId !== plano.decisao.id ||
      s.disponibilizacaoId !== plano.disponibilizacao.id || s.reservaId !== item.reservaId || s.habilidade !== item.habilidade) continue;
    const resultado = decidirVigenciaAutorizacaoEspecialRecuperacao({
      id: a.id, matriculaId: s.matriculaId, alocacaoId: s.alocacaoId, regraId: s.regraId, itemReservaId: s.itemReservaId,
      autorizadorId: a.autorizadorId, motivo: a.motivo, autorizadaEm: a.criadaEm.toISOString(), prazoAte: a.prazoAte.toISOString(), chaveIdempotencia: a.chaveIdempotencia,
    }, { matriculaId: plano.matriculaId, alocacaoId: plano.alocacaoId, regraId: plano.regraId, itemReservaId, realizadaEm: realizadaEm.toISOString(),
      autorizadorVigente: a.autorizador.ativo && a.autorizador.papeis.some(p => p === Papel.GERENTE_PEDAGOGICO || p === Papel.ADMINISTRADOR),
    });
    if (resultado.vigente) return { id: a.id, prazoAte: a.prazoAte };
  }
  return null;
}
