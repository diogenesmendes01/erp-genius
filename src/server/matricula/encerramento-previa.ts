"use server";
import { Papel, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { executarAcao, exigirSessaoComPapel } from "@/server/_shared";
import { carregarPreviaMensalEncerramentoTx } from "./encerramento-previa-tx";
import { PreviaMensalPedidoEncerramentoSchema, type PreviaMensalPedidoEncerramentoInput } from "./encerramento-previa-schema";

/** Leitura consistente de todos os contratos; não efetiva o acerto. */
export async function preverComponenteMensalEncerramento(input: PreviaMensalPedidoEncerramentoInput) {
  return executarAcao(async () => {
    await exigirSessaoComPapel(Papel.FINANCEIRO);
    const d = PreviaMensalPedidoEncerramentoSchema.parse(input);
    return prisma.$transaction((tx) => carregarPreviaMensalEncerramentoTx(tx, d), { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });
  });
}
