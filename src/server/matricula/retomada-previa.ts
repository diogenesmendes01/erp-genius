"use server";
import { prisma } from "@/lib/prisma";
import { executarAcao, exigirSessaoComPapel } from "@/server/_shared";
import { PAPEIS_PAUSA } from "./pausa-estado";
import { carregarPreviaRetomadaTx } from "./retomada-estado";
import { PreviaRetomadaMatriculasSchema, type PreviaRetomadaMatriculasInput } from "./retomada-schema";

/** Consulta operacional sem mutação. */
export async function preverRetomadaMatriculas(alunoId: string, input: PreviaRetomadaMatriculasInput) {
  return executarAcao(async () => {
    const autor = await exigirSessaoComPapel(...PAPEIS_PAUSA);
    const dados = PreviaRetomadaMatriculasSchema.parse(input);
    return prisma.$transaction((tx) => carregarPreviaRetomadaTx(tx, alunoId, dados, autor.id));
  });
}
