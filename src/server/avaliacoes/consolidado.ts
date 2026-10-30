"use server";
import { Papel } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { executarAcao, exigirSessaoComPapel } from "@/server/_shared";
import { SalvarLancamentoSchema } from "./lancamento-schema";
import { carregarConsolidadoAvaliacoesTx } from "./consolidado-tx";
import { carregarFrequenciaVinculoTx } from "./frequencia-tx";
import { exigirConteudoRegra } from "./regra-conteudo";
import { carregarPendenciasFechamentoTx } from "./pendencias-fechamento-tx";

export async function consultarConsolidadoAvaliacoes(alocacaoId: string) {
  return executarAcao(async () => {
    const u = await exigirSessaoComPapel(Papel.PROFESSOR, Papel.GERENTE_PEDAGOGICO);
    const id = SalvarLancamentoSchema.shape.alocacaoId.parse(alocacaoId);
    return prisma.$transaction(async tx => {
      const consolidado = await carregarConsolidadoAvaliacoesTx(tx, u.id, id, "ACOMPANHAMENTO");
      const a = await tx.alocacaoTurma.findUniqueOrThrow({ where: { id }, include: { turma: { include: { regraAvaliacao: true } } } });
      const regra = exigirConteudoRegra(a.turma.regraAvaliacao!.conteudo);
      const frequencia = await carregarFrequenciaVinculoTx(tx, { ...a, matriculaId: a.matriculaId! }, a.turma.nivelId, regra.frequenciaMinimaPercentual);
      const pendenciasFechamento = await carregarPendenciasFechamentoTx(tx, {
        alocacaoId: a.id, matriculaId: a.matriculaId!, nivelId: a.turma.nivelId, regraId: a.turma.regraAvaliacao!.id,
      });
      const { extrasRecuperacaoAguardandoDecisao, ...basePendencias } = pendenciasFechamento.pendenciasOperacionais;
      const pendenciasOperacionais = { ...basePendencias, oportunidadesExtrasAguardandoDecisao: extrasRecuperacaoAguardandoDecisao };
      return { ...consolidado, frequencia, pendenciasOperacionais, pendenciasSegundaChamada: pendenciasFechamento.pendenciasSegundaChamada };
    });
  });
}
