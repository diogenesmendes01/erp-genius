"use server";

import { prisma } from "@/lib/prisma";
import { executarAcao, exigirSessaoComPapel, ErroRegra } from "@/server/_shared";
import { PreviaPausaMatriculasSchema, type PreviaPausaMatriculasInput } from "./pausa-schema";
import { carregarPreviaPausaTx, PAPEIS_PAUSA } from "./pausa-estado";

/** Prévia operacional sem valores financeiros: não autoriza nem efetiva uma pausa. */
export async function preverPausaMatriculas(alunoId: string, input: PreviaPausaMatriculasInput) {
  return executarAcao(async () => {
    const autor = await exigirSessaoComPapel(...PAPEIS_PAUSA);
    const dados = PreviaPausaMatriculasSchema.parse(input);
    if (!alunoId.trim()) throw new ErroRegra("Aluno obrigatório.");
    return prisma.$transaction((tx) => carregarPreviaPausaTx(tx, alunoId, dados, autor.id));
  });
}
