"use server";
import { isDeepStrictEqual } from "node:util";
import { Papel, Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { executarAcao, exigirSessaoComPapel, ErroRegra } from "@/server/_shared";
import { PreviaMensalPedidoEncerramentoSchema } from "./encerramento-previa-schema";
import { carregarPreviaMensalEncerramentoTx } from "./encerramento-previa-tx";

/** Diagnóstico em leitura; não concede aprovação nem garante validade futura. */
export async function conferirValidadeRascunhoEncerramento(input: { alunoId: string; solicitacaoId: string; rascunhoId: string }) {
  return executarAcao(async () => {
    await exigirSessaoComPapel(Papel.FINANCEIRO);
    const d = z.object({ alunoId: z.string().min(1), solicitacaoId: z.string().min(1), rascunhoId: z.string().min(1) }).strict().parse(input);
    return prisma.$transaction(async (tx) => {
      const r = await tx.rascunhoAcertoEncerramento.findFirst({ where: { id: d.rascunhoId, solicitacaoId: d.solicitacaoId, solicitacao: { alunoId: d.alunoId } } });
      if (!r) throw new ErroRegra("Rascunho não encontrado para este pedido e aluno.");
      const motivos: string[] = [];
      if (await tx.rascunhoAcertoEncerramento.count({ where: { solicitacaoId: r.solicitacaoId, versao: { gt: r.versao } } })) motivos.push("Existe uma versão mais recente deste rascunho.");
      const entrada = PreviaMensalPedidoEncerramentoSchema.safeParse(r.entrada);
      if (!entrada.success || entrada.data.solicitacaoId !== d.solicitacaoId || entrada.data.alunoId !== d.alunoId) {
        motivos.push("A entrada registrada está incompleta ou incompatível com o pedido.");
      } else {
        try {
          const atual = await carregarPreviaMensalEncerramentoTx(tx, entrada.data);
          if (!isDeepStrictEqual(r.snapshot, atual)) motivos.push("O pedido, as condições ou as origens financeiras mudaram desde esta versão. Prepare nova conferência.");
        } catch (e) {
          if (e instanceof ErroRegra) motivos.push(e.message);
          else if (e instanceof z.ZodError) motivos.push("As condições atuais não permitem reproduzir o cálculo registrado.");
          else throw e;
        }
      }
      return { rascunhoId: r.id, versao: r.versao, atual: motivos.length === 0, motivos, conferidoEm: new Date().toISOString() };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });
  });
}
