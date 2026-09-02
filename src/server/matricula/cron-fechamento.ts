import { StatusCobranca, StatusMatricula, TipoCobranca } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ativarSeFechamentoCompletoTx } from "./acoes";

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

  const pendentes = await prisma.matricula.findMany({
    where: {
      status: StatusMatricula.AGUARDANDO,
      contratoOk: true,
      cobrancas: { some: { tipo: TipoCobranca.MATRICULA, status: StatusCobranca.PAGO } },
    },
    select: { id: true },
  });

  let ativadas = 0;
  for (const m of pendentes) {
    // Transação POR matrícula: uma falha isolada não derruba o backfill inteiro.
    try {
      const r = await prisma.$transaction((tx) => ativarSeFechamentoCompletoTx(tx, m.id, null));
      if (r.ativou) ativadas += 1;
    } catch (e) {
      console.error(`[cron fechamento] matrícula ${m.id} falhou:`, e);
    }
  }
  return { executou: true, motivoParada: null, avaliadas: pendentes.length, ativadas };
}
