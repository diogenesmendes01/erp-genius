"use server";
import { Papel } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { executarAcao, exigirSessaoComPapel } from "@/server/_shared";
import { SalvarLancamentoSchema } from "./lancamento-schema";
import { carregarConsolidadoAvaliacoesTx } from "./consolidado-tx";
import { carregarFrequenciaVinculoTx } from "./frequencia-tx";
import { ConteudoRegraAvaliacaoSchema } from "./regra-schema";
import { carregarPendenciasFechamentoTx } from "./pendencias-fechamento-tx";

/** Acompanhamento atual das avaliações regulares; não é fechamento ou decisão de progressão. */
export async function consultarConsolidadoAvaliacoes(alocacaoId: string) {
  return executarAcao(async () => {
    const u = await exigirSessaoComPapel(Papel.PROFESSOR, Papel.GERENTE_PEDAGOGICO);
    const id = SalvarLancamentoSchema.shape.alocacaoId.parse(alocacaoId);
    return prisma.$transaction(async tx => {
      const consolidado = await carregarConsolidadoAvaliacoesTx(tx, u.id, id, "ACOMPANHAMENTO");
      // O serviço acima autoriza e bloqueia o vínculo e sua regra. A apuração
      // de consulta não entra na memória estável dos planos de recuperação.
      const a = await tx.alocacaoTurma.findUniqueOrThrow({ where: { id }, include: { turma: { include: { regraAvaliacao: true } } } });
      const regra = ConteudoRegraAvaliacaoSchema.parse(a.turma.regraAvaliacao!.conteudo);
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
