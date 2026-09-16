"use server";
import { Papel, Prisma } from "@prisma/client";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { executarAcao, exigirSessaoComPapel } from "@/server/_shared";
import { efetivarAcertoEncerramentoTx } from "./encerramento-efetivar-tx";

export async function efetivarAcertoEncerramento(input: { alunoId: string; decisaoId: string }) {
  return executarAcao(async () => {
    const usuario = await exigirSessaoComPapel(Papel.FINANCEIRO);
    const d = z.object({ alunoId: z.string().min(1), decisaoId: z.string().min(1) }).strict().parse(input);
    const r = await prisma.$transaction(tx => efetivarAcertoEncerramentoTx(tx, { ...d, executorId: usuario.id }, new Date()), { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted });
    revalidatePath(`/alunos/${d.alunoId}/movimentacoes`);
    revalidatePath(`/alunos/${d.alunoId}`);
    revalidatePath(`/alunos/${d.alunoId}/financeiro`);
    revalidatePath("/financeiro");
    return r;
  });
}
