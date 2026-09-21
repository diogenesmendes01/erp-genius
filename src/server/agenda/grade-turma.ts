"use server";
import { Papel, Prisma } from "@prisma/client";
import { z } from "zod";
import { carregarGradeInicialTx } from "./grade-turma-tx";
import { prisma } from "@/lib/prisma";
import { executarAcao, exigirSessaoComPapel } from "@/server/_shared";
import { FusoInstitucionalSchema } from "@/server/operacao/fuso";

/** Prévia inicial: parâmetros acadêmicos vêm do catálogo; fuso é proposto explicitamente. */
export async function preverGradeInicialTurma(input: { turmaId: string; fusoOrigem: string }) {
  return executarAcao(async () => {
    await exigirSessaoComPapel(Papel.SECRETARIA_ACADEMICA, Papel.GERENTE_PEDAGOGICO);
    const d = z.object({ turmaId: z.string().min(1), fusoOrigem: FusoInstitucionalSchema }).strict().parse(input);
    return prisma.$transaction((tx) => carregarGradeInicialTx(tx, d), { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });
  });
}
