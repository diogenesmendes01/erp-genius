import { prisma } from "@/lib/prisma";
import { reavaliarAcessoAutomaticoDaCobranca } from "@/server/cobrancas/acesso-aulas";

/** Executar somente após confirmar a transação financeira, inclusive no replay. */
export async function reavaliarAcessoAposPermuta(decisaoId: string) {
  try {
    const aplicacoes = await prisma.aplicacaoCompensacaoPermuta.findMany({
      where: { decisaoId }, select: { cobrancaId: true },
    });
    for (const cobrancaId of new Set(aplicacoes.map(a => a.cobrancaId))) {
      try {
        await reavaliarAcessoAutomaticoDaCobranca(cobrancaId);
      } catch {
        console.error("[permuta] Compensação confirmada; reavaliação do acesso pendente pelo cron institucional.");
      }
    }
  } catch {
    console.error("[permuta] Compensação confirmada; consulta das aplicações para reavaliar acesso pendente pelo cron institucional.");
  }
}
