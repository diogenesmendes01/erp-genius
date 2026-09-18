"use server";

import { Papel, Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { executarAcao, exigirSessaoComPapel, type Resultado } from "@/server/_shared";
import {
  iniciarCancelamentoAssinaturaDesistenciaTx,
} from "@/server/contratos/cancelamento-assinatura-tx";

const iniciarSchema = z.object({
  pedidoId: z.string().trim().min(1).max(100),
  processoId: z.string().trim().min(1).max(100),
  estadoHash: z.string().regex(/^[a-f0-9]{64}$/),
}).strict();

type Inicio = { id: string; nova: boolean; referenciaExterna: string; fornecedor: string; ambiente: string };

/** Registra a intenção Q121 de cancelar um envio já aberto. Esta ação não
 * chama nem aceita uma resposta do fornecedor. O resultado pertence ao
 * adaptador autenticado/conciliador server-side. */
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
