import type { Prisma } from "@prisma/client";
import { z } from "zod";
import { HABILIDADES } from "./calculo";

export const EstadoExtraSchema = z.object({
  alocacaoId: z.string(), matriculaId: z.string(), nivelId: z.string(), regraId: z.string(),
  ativa: z.boolean(), statusMatricula: z.string(), habilidade: z.enum(HABILIDADES),
  limiteBase: z.number().int().nonnegative().safe(), extrasAprovados: z.number().int().nonnegative().safe(), ocupadas: z.number().int().nonnegative().safe(),
});

/** Sob os mesmos locks do vínculo usados pelas reservas. */
export async function estadoExtraRecuperacaoTx(tx: Prisma.TransactionClient, alocacaoId: string, habilidade: string) {
  const [r] = await tx.$queryRaw<{ estado: unknown }[]>`SELECT estado_extra_recuperacao(${alocacaoId}, ${habilidade}) AS estado`;
  return EstadoExtraSchema.parse(r.estado);
}

export async function quantidadeExtraRecuperacaoTx(tx: Prisma.TransactionClient, matriculaId: string, nivelId: string, habilidade: string) {
  const r = await tx.propostaExtraRecuperacao.aggregate({ where: { matriculaId, nivelId, habilidade, decisao: { aprovada: true } }, _sum: { quantidade: true } });
  return r._sum.quantidade ?? 0;
}
