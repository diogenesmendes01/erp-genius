"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { executarAcao, exigirSessaoComPapel, ErroRegra } from "@/server/_shared";
import { PAPEIS_PAUSA } from "./pausa-estado";
import { aplicarPausaMatriculasTx } from "./pausa-execucao";
import { aplicarRetomadaMatriculasTx } from "./retomada-execucao";

const schema = z.object({ alunoId: z.string().min(1), propostaId: z.string().min(1), tipo: z.enum(["PAUSA", "RETOMADA"]) }).strict();
export async function aplicarMovimentacaoContratual(input: z.input<typeof schema>) {
  return executarAcao(async () => {
    const autor = await exigirSessaoComPapel(...PAPEIS_PAUSA);
    const dados = schema.parse(input);
    const resultado = await prisma.$transaction(async (tx) => {
      const consulta = { where: { id: dados.propostaId, alunoId: dados.alunoId }, select: { id: true } };
      const p = dados.tipo === "PAUSA" ? await tx.propostaPausaMatriculas.findFirst(consulta) : await tx.propostaRetomadaMatriculas.findFirst(consulta);
      if (!p) throw new ErroRegra("Proposta não encontrada para este aluno.");
      const agora = new Date();
      return dados.tipo === "PAUSA" ? aplicarPausaMatriculasTx(tx, p.id, autor.id, agora) : aplicarRetomadaMatriculasTx(tx, p.id, autor.id, agora);
    });
    revalidatePath(`/alunos/${dados.alunoId}`, "layout");
    revalidatePath("/financeiro", "layout"); revalidatePath("/academico"); revalidatePath("/diario");
    return resultado;
  });
}
