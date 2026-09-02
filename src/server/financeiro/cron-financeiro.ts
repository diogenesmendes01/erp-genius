import { prisma } from "@/lib/prisma";
import { fecharComissoesAprovadasTx } from "./acoes";

// FECHAMENTO MENSAL AUTOMÁTICO de comissões (Fase 2, doc 03 §Comissão): com a config
// ligada (nasce desligada), o primeiro tick de cada mês paga as comissões APROVADAS
// ATÉ o fim do mês ANTERIOR (corte por `aprovadaEm` — review PR #60) —
// idempotente por competência (evento `FechamentoComissoesMensal { mes }`). Se o servidor
// perder o dia 1, o próximo tick do mês fecha (rolling, nunca duplica).

export interface ResultadoFechamentoComissoes {
  executou: boolean;
  motivoParada: string | null;
  mes: string | null;
  pagas: number;
}

function mesISO(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export async function rodarFechamentoComissoes(agora: Date = new Date()): Promise<ResultadoFechamentoComissoes> {
  const config = await prisma.configFinanceiro.findUnique({ where: { id: "financeiro" } });
  if (!config?.fechamentoComissaoAutomatico) {
    return { executou: false, motivoParada: "fechamento_automatico_desligado", mes: null, pagas: 0 };
  }

  const mes = mesISO(agora);
  const jaFechado = await prisma.evento.count({
    where: {
      agregadoTipo: "ConfigFinanceiro",
      agregadoId: "financeiro",
      tipo: "FechamentoComissoesMensal",
      payload: { path: ["mes"], equals: mes },
    },
  });
  if (jaFechado > 0) return { executou: false, motivoParada: "ja_fechado_no_mes", mes, pagas: 0 };

  // CORTE DE COMPETÊNCIA (review PR #60): o automático paga só o que foi aprovado ANTES
  // do mês corrente — ligar a flag no dia 20 não antecipa as vendas do próprio mês.
  const inicioMesCorrente = new Date(agora.getFullYear(), agora.getMonth(), 1);
  const pagas = await prisma.$transaction(async (tx) => {
    const n = await fecharComissoesAprovadasTx(tx, null, inicioMesCorrente); // autor = sistema
    await tx.evento.create({
      data: {
        tipo: "FechamentoComissoesMensal",
        agregadoTipo: "ConfigFinanceiro",
        agregadoId: "financeiro",
        autorId: null,
        payload: { mes, pagas: n },
      },
    });
    return n;
  });

  return { executou: true, motivoParada: null, mes, pagas };
}
