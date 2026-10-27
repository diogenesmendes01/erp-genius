import type { Prisma } from "@prisma/client";
import type { EntradaElegibilidadeFechamento } from "./fechamento-elegibilidade";
import { carregarPendenciasResultadoTx } from "./pendencias-resultado-tx";

export type ContextoPendenciasFechamento = {
  alocacaoId: string;
  matriculaId: string;
  nivelId: string;
  regraId: string;
};

export type PendenciasFechamentoColetadas = Pick<
  EntradaElegibilidadeFechamento,
  "pendenciasOperacionais" | "pendenciasSegundaChamada"
>;

export async function carregarPendenciasFechamentoTx(
  tx: Prisma.TransactionClient,
  contexto: ContextoPendenciasFechamento,
): Promise<PendenciasFechamentoColetadas> {
  const escopoSegunda = {
    alocacaoId: contexto.alocacaoId,
    matriculaId: contexto.matriculaId,
    nivelId: contexto.nivelId,
    regraId: contexto.regraId,
  };
  const [operacionais, propostasAguardandoDecisao, autorizacoesAguardandoAgenda, reservasAguardandoRealizacao, ocorrenciasAguardandoEscola, realizacoesSemNotaOficial, extrasAguardandoDecisao] = await Promise.all([
    carregarPendenciasResultadoTx(tx, contexto),
    tx.propostaSegundaChamada.count({ where: { ...escopoSegunda, decisao: null } }),
    tx.propostaSegundaChamada.count({ where: {
      ...escopoSegunda,
      decisao: { aprovada: true },
      OR: [
        { disponibilizacao: null },
        { reservas: { none: {} } },
      ],
    } }),
    tx.reservaSegundaChamada.count({ where: {
      status: "RESERVADA",
      proposta: escopoSegunda,
    } }),
    tx.reservaSegundaChamada.count({ where: {
      status: "PENDENCIA_ESCOLA",
      resolucaoImpedimento: null,
      proposta: escopoSegunda,
    } }),
    tx.realizacaoSegundaChamada.count({ where: {
      reserva: { proposta: escopoSegunda },
      NOT: {
        lancamentosOriginais: { some: { decisao: { is: { aprovada: true } } } },
      },
    } }),
    tx.propostaExtraSegundaChamada.count({ where: {
      matriculaId: contexto.matriculaId,
      alocacaoId: contexto.alocacaoId,
      regraId: contexto.regraId,
      decisao: null,
    } }),
  ]);

  return {
    pendenciasOperacionais: {
      correcoesRegulares: operacionais.correcoesRegulares,
      correcoesRecuperacao: operacionais.correcoesRecuperacao,
      planosAguardandoDecisao: operacionais.planosAguardandoDecisao,
      planosSemDisponibilizacao: operacionais.planosSemDisponibilizacao,
      tentativasAguardandoRealizacao: operacionais.tentativasAguardandoRealizacao,
      habilidadesSemTentativa: operacionais.habilidadesSemTentativa,
      extrasRecuperacaoAguardandoDecisao: operacionais.oportunidadesExtrasAguardandoDecisao,
    },
    pendenciasSegundaChamada: {
      propostasAguardandoDecisao,
      autorizacoesAguardandoAgenda,
      reservasAguardandoRealizacao,
      ocorrenciasAguardandoEscola,
      realizacoesSemNotaOficial,
      extrasAguardandoDecisao,
    },
  };
}
