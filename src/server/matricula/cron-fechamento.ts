import { prisma } from "@/lib/prisma";

// BACKFILL da matrícula automática (review PR #60): os gatilhos (assinatura, baixa da
// taxa) só disparam NO MOMENTO em que acontecem — se ambos ocorreram com a config
// desligada, ligar depois deixava a matrícula presa em AGUARDANDO. Este scanner roda no
// tick do cron e é idempotente: `ativarSeFechamentoCompletoTx` re-checa config + estado e
// só ativa quem está completo; quem ativou sai do filtro no tick seguinte.

export interface ResultadoFechamentosPendentes {
  executou: boolean;
  motivoParada: string | null;
  avaliadas: number;
  ativadas: number;
}

export async function rodarFechamentosPendentes(): Promise<ResultadoFechamentosPendentes> {
  const config = await prisma.configComercial.findUnique({ where: { id: "comercial" } });
  if (!config?.matriculaAutomaticaAtiva) {
    return { executou: false, motivoParada: "matricula_automatica_desligada", avaliadas: 0, ativadas: 0 };
  }

  // A flag comercial não substitui a preparação, aceite da Secretaria, reserva,
  // grade, pré-pagamento e aprovações. Enquanto o gatilho não reaplicar esse
  // fluxo integral, o cron permanece observável e não tenta ativar contratos.
  return {
    executou: false,
    motivoParada: "matricula_automatica_aguarda_fluxo_seguro",
    avaliadas: 0,
    ativadas: 0,
  };

}
