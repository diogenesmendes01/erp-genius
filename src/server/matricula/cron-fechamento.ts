import { prisma } from "@/lib/prisma";

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

  return {
    executou: false,
    motivoParada: "matricula_automatica_aguarda_fluxo_seguro",
    avaliadas: 0,
    ativadas: 0,
  };

}
