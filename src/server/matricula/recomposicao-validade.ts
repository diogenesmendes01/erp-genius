"use server";
import { isDeepStrictEqual } from "node:util";
import { Papel } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { executarAcao, exigirSessaoComPapel, ErroRegra } from "@/server/_shared";
import { EntradaRecomposicao } from "./recomposicao-schema";
import { carregarRecomposicaoTx } from "./recomposicao-tx";
import { ErroRecomposicao } from "./recomposicao-cobertura";

/** Diagnóstico em leitura. A aprovação deverá repetir a conferência sob bloqueio. */
export async function conferirValidadeRascunhoRecomposicao(input: { alunoId: string; matriculaId: string; rascunhoId: string }) {
  return executarAcao(async () => {
    await exigirSessaoComPapel(Papel.FINANCEIRO);
    const d = z.object({ alunoId: z.string().min(1), matriculaId: z.string().min(1), rascunhoId: z.string().min(1) }).strict().parse(input);
    return prisma.$transaction(async (tx) => {
      const r = await tx.rascunhoRecomposicaoCobertura.findFirst({ where: { id: d.rascunhoId, matriculaId: d.matriculaId, matricula: { alunoId: d.alunoId } } });
      if (!r) throw new ErroRegra("Rascunho não encontrado para este aluno e matrícula.");
      const motivos: string[] = [];
      if (await tx.rascunhoRecomposicaoCobertura.count({ where: { matriculaId: r.matriculaId, versao: { gt: r.versao } } })) motivos.push("Existe uma versão mais recente da recomposição.");
      const entrada = EntradaRecomposicao.safeParse(r.entrada);
      if (!entrada.success || entrada.data.alunoId !== d.alunoId || entrada.data.matriculaId !== d.matriculaId) motivos.push("Entrada registrada incompleta ou incompatível com a matrícula.");
      else {
        try {
          const atual = await carregarRecomposicaoTx(tx, entrada.data);
          if (!isDeepStrictEqual(r.snapshot, atual)) motivos.push("Contrato, cobranças ou direitos mudaram desde o salvamento. Prepare uma nova versão.");
        } catch (e) {
          if (e instanceof ErroRegra || e instanceof ErroRecomposicao) motivos.push(e.message);
          else if (e instanceof z.ZodError) motivos.push("Os dados atuais não permitem reproduzir a proposta.");
          else throw e;
        }
      }
      return { rascunhoId: r.id, versao: r.versao, atual: motivos.length === 0, motivos, conferidoEm: new Date().toISOString() };
    }, { isolationLevel: "RepeatableRead" });
  });
}
