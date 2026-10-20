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

/**
 * Lê apenas fontes ainda abertas no mesmo vínculo, matrícula, nível e versão
 * de regra. Não decide fechamento: quem o fizer deve combinar este retorno ao
 * snapshot de notas, à frequência e à equivalência sob os próprios locks.
 */
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
    // A decisão aprovada precisa de disponibilização e primeira reserva. Uma
    // reserva terminal já é histórico; ela não se transforma em bloqueio
    // eterno por ter sido cancelada corretamente.
    tx.propostaSegundaChamada.count({ where: {
      ...escopoSegunda,
      decisao: { aprovada: true },
      OR: [
        { disponibilizacao: null },
        { reservas: { none: {} } },
      ],
    } }),
    // Reservas liberadas por cancelamento correto e reservas já consumidas não
    // aguardam realização; PENDENCIA_ESCOLA tem motivo próprio abaixo.
    tx.reservaSegundaChamada.count({ where: {
      status: "RESERVADA",
      proposta: escopoSegunda,
    } }),
    tx.reservaSegundaChamada.count({ where: {
      status: "PENDENCIA_ESCOLA",
      // Q164: a confirmação da gestão encerra a pendência sem reescrever o histórico.
      resolucaoImpedimento: null,
      proposta: escopoSegunda,
    } }),
    // Uma realização não é resultado: enquanto o lançamento original não for
    // oficializado, a avaliação continua pendente, inclusive se foi rejeitada.
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
