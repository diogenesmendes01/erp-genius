"use server";
import { Papel } from "@prisma/client";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { executarAcao, exigirSessaoComPapel } from "@/server/_shared";
import { emitirFechamentoHorasTx } from "./fechamento-horas-emissao-tx";

const Entrada = z.object({ alunoId: z.string().min(1), matriculaId: z.string().min(1), decisaoId: z.string().min(1) }).strict();
export async function emitirFechamentoHoras(input: z.input<typeof Entrada>) {
  return executarAcao(async () => {
    const autor = await exigirSessaoComPapel(Papel.FINANCEIRO), d = Entrada.parse(input);
    const resultado = await prisma.$transaction(tx => emitirFechamentoHorasTx(tx, { ...d, executorId: autor.id }));
    revalidatePath(`/matriculas/${d.matriculaId}/fechamentos-horas`);
    revalidatePath(`/alunos/${d.alunoId}/financeiro`);
    revalidatePath("/financeiro", "layout");
    return resultado;
  });
}
