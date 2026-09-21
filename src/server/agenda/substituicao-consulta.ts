"use server";
import { Papel, Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { executarAcao, exigirSessaoComPapel } from "@/server/_shared";
import { conferirSubstituicaoTx } from "./substituicao-conferencia";

export async function consultarPropostaSubstituicao(input: { propostaId: string }) {
  return executarAcao(async () => {
    await exigirSessaoComPapel(Papel.SECRETARIA_ACADEMICA, Papel.GERENTE_PEDAGOGICO);
    const d = z.object({ propostaId: z.string().min(1) }).strict().parse(input);
    return prisma.$transaction((tx) => conferirSubstituicaoTx(tx, d.propostaId), { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });
  });
}
