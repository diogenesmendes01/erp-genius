import { prisma } from "@/lib/prisma";
import { reavaliarAcessoAutomaticoMatriculaTx } from "@/server/cobrancas/acesso-aulas";

export async function reconciliarAcessoVencimento(aplicacaoId: string) {
  try {
    return await prisma.$transaction(async tx => {
      const itens = await tx.$queryRaw<{ aplicacaoId: string }[]>`SELECT "aplicacaoId" FROM "ReconciliacaoAcessoVencimento" WHERE "aplicacaoId" = ${aplicacaoId} AND "concluidaEm" IS NULL FOR UPDATE SKIP LOCKED`;
      if (!itens.length) return "inalterado" as const;
      const aplicacao = await tx.aplicacaoVencimentoAditivo.findUniqueOrThrow({ where: { id: aplicacaoId }, select: { decisao: { select: { proposta: { select: { matriculaId: true } } } } } });
      await reavaliarAcessoAutomaticoMatriculaTx(tx, aplicacao.decisao.proposta.matriculaId, new Date(), { naoAguardarCobrancas: true });
      await tx.reconciliacaoAcessoVencimento.update({ where: { aplicacaoId }, data: { concluidaEm: new Date(), ultimaTentativaEm: new Date(), tentativas: { increment: 1 }, erro: null } });
      return "concluido" as const;
    }, { timeout: 30000 });
  } catch {
    try {
      await prisma.reconciliacaoAcessoVencimento.updateMany({ where: { aplicacaoId, concluidaEm: null }, data: { ultimaTentativaEm: new Date(), tentativas: { increment: 1 }, erro: "Falha na reavaliação de acesso; nova tentativa pendente." } });
    } catch { console.error("[aditivo] Não foi possível registrar a tentativa de reconciliação de acesso."); }
    return "pendente" as const;
  }
}

export async function rodarReconciliacaoAcessoVencimento() {
  const itens = await prisma.$queryRaw<{ aplicacaoId: string }[]>`SELECT "aplicacaoId" FROM "ReconciliacaoAcessoVencimento" WHERE "concluidaEm" IS NULL ORDER BY COALESCE("ultimaTentativaEm", "criadaEm"), "aplicacaoId" LIMIT 100`;
  const resultado = { concluidos: 0, pendentes: 0, inalterados: 0 };
  for (const item of itens) {
    const estado = await reconciliarAcessoVencimento(item.aplicacaoId);
    if (estado === "concluido") resultado.concluidos++;
    else if (estado === "pendente") resultado.pendentes++;
    else resultado.inalterados++;
  }
  return resultado;
}
