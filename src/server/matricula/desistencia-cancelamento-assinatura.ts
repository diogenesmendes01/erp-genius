"use server";

import { Papel, Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { executarAcao, exigirSessaoComPapel, type Resultado } from "@/server/_shared";
import {
  iniciarCancelamentoAssinaturaDesistenciaTx,
  registrarObservacaoCancelamentoDesistenciaTx,
} from "@/server/contratos/cancelamento-assinatura-tx";

const iniciarSchema = z.object({
  pedidoId: z.string().trim().min(1).max(100),
  processoId: z.string().trim().min(1).max(100),
  estadoHash: z.string().regex(/^[a-f0-9]{64}$/),
}).strict();

const observacaoSchema = z.object({
  intencaoId: z.string().trim().min(1).max(100),
  pedidoId: z.string().trim().min(1).max(100),
  processoId: z.string().trim().min(1).max(100),
  chave: z.string().trim().min(8).max(200),
  resultado: z.enum(["INCERTO", "CONFIRMADO"]),
  referenciaExterna: z.string().trim().min(1).max(200),
  evidenciaHash: z.string().regex(/^[a-f0-9]{64}$/),
}).strict();

type Inicio = { id: string; nova: boolean; referenciaExterna: string; fornecedor: string; ambiente: string };
type Observacao = { id: string; cancelamentoConfirmado: boolean };

/** Registra a intenção Q121 de cancelar um envio já aberto. O resultado do
 * fornecedor é informado em operação separada e idempotente; esta ação não
 * aciona o fornecedor externo. */
export async function iniciarCancelamentoAssinaturaDesistencia(input: z.input<typeof iniciarSchema>): Promise<Resultado<Inicio>> {
  return executarAcao(async () => {
    const sessao = await exigirSessaoComPapel(Papel.SECRETARIA_ACADEMICA);
    const dados = iniciarSchema.parse(input);
    return prisma.$transaction(
      (tx) => iniciarCancelamentoAssinaturaDesistenciaTx(tx, sessao.id, dados),
      { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted },
    );
  });
}

/** Preserva uma resposta obtida do fornecedor para a intenção Q121 já criada.
 * Não efetiva a desistência: a Secretaria ainda precisa confirmá-la depois da
 * evidência de cancelamento. */
export async function registrarObservacaoCancelamentoAssinaturaDesistencia(input: z.input<typeof observacaoSchema>): Promise<Resultado<Observacao>> {
  return executarAcao(async () => {
    await exigirSessaoComPapel(Papel.SECRETARIA_ACADEMICA);
    const dados = observacaoSchema.parse(input);
    return prisma.$transaction(
      (tx) => registrarObservacaoCancelamentoDesistenciaTx(tx, dados),
      { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted },
    );
  });
}
