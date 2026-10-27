import { prisma } from "@/lib/prisma";
import { inicioDoDiaCivil, dataCivilInstitucional } from "@/server/operacao/fuso";
import { fusoDaEscola } from "@/server/relatorios/atendimento";
import { fecharComissoesAprovadasTx } from "./acoes";

export interface ResultadoFechamentoComissoes {
  executou: boolean;
  motivoParada: string | null;
  mes: string | null;
  pagas: number;
}

export async function rodarFechamentoComissoes(agora: Date = new Date()): Promise<ResultadoFechamentoComissoes> {
  const config = await prisma.configFinanceiro.findUnique({ where: { id: "financeiro" } });
  if (!config?.fechamentoComissaoAutomatico) {
    return { executou: false, motivoParada: "fechamento_automatico_desligado", mes: null, pagas: 0 };
  }

  const fuso = await fusoDaEscola();
  const mes = dataCivilInstitucional(agora, fuso).slice(0, 7);
  const inicioMesCorrente = inicioDoDiaCivil(`${mes}-01`, fuso);
  const pagas = await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${"fechamento_comissoes_" + mes}))`;
    const jaFechado = await tx.evento.count({
      where: {
        agregadoTipo: "ConfigFinanceiro",
        agregadoId: "financeiro",
        tipo: "FechamentoComissoesMensal",
        payload: { path: ["mes"], equals: mes },
      },
    });
    if (jaFechado > 0) return null;
    const n = await fecharComissoesAprovadasTx(tx, null, inicioMesCorrente);
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
  if (pagas === null) return { executou: false, motivoParada: "ja_fechado_no_mes", mes, pagas: 0 };

  return { executou: true, motivoParada: null, mes, pagas };
}
