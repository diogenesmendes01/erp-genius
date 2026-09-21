"use server";
import { Papel, Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { executarAcao, exigirSessaoComPapel } from "@/server/_shared";
import { carregarContextoEncerramentoTx } from "./encerramento-contexto-tx";

export async function consultarContextoEncerramento(input: { alunoId: string; matriculaId: string }) {
  return executarAcao(async () => {
    await exigirSessaoComPapel(Papel.FINANCEIRO);
    const d = z.object({ alunoId: z.string().min(1), matriculaId: z.string().min(1) }).strict().parse(input);
    return prisma.$transaction((tx) => carregarContextoEncerramentoTx(tx, d), { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });
  });
}
