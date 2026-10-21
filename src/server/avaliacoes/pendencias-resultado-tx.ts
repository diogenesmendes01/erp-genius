import type { Prisma } from "@prisma/client";
import { z } from "zod";
import { HABILIDADES } from "./calculo";

/** Consultar somente após autorizar e bloquear o vínculo. Contagens operacionais
 * complementam notas/frequência; ausência de itens não comprova fechamento. */
export async function carregarPendenciasResultadoTx(tx: Prisma.TransactionClient, contexto: {
  alocacaoId: string; matriculaId: string; nivelId: string; regraId: string;
}) {
  const plano = { ...contexto };
  const [correcoesRegulares, correcoesRecuperacao, planosAguardandoDecisao, planosSemDisponibilizacao, tentativasAguardandoRealizacao, planosAprovados, oportunidadesExtrasAguardandoDecisao] = await Promise.all([
    tx.propostaCorrecaoNota.count({ where: { decisao: null, lancamento: { registro: {
      alocacaoId: contexto.alocacaoId, matriculaId: contexto.matriculaId, regraId: contexto.regraId,
    } } } }),
    tx.propostaCorrecaoRecuperacao.count({ where: { decisao: null, notaOriginal: {
      realizacao: { itemReserva: { reserva: { proposta: plano } } },
    } } }),
    tx.propostaPlanoRecuperacao.count({ where: { ...plano, decisao: null } }),
    tx.propostaPlanoRecuperacao.count({ where: { ...plano, decisao: { aprovada: true }, disponibilizacao: null } }),
    tx.itemReservaTentativaRecuperacao.count({ where: { realizacao: null, reserva: {
      cancelamento: null, proposta: { ...plano, decisao: { aprovada: true } },
    } } }),
    tx.propostaPlanoRecuperacao.findMany({ where: { ...plano, decisao: { aprovada: true } }, select: {
      atividades: true, reservasTentativa: { select: {
        cancelamento: { select: { id: true } }, itens: { select: { habilidade: true, realizacao: { select: { id: true } } } },
      } },
    } }),
    tx.propostaExtraRecuperacao.count({ where: {
      // A versão da regra é um snapshot já persistido nessa fonte legada; sem
      // ela, um extra de regra anterior não pode bloquear outro fechamento.
      matriculaId: contexto.matriculaId, alocacaoId: contexto.alocacaoId, nivelId: contexto.nivelId,
      snapshot: { path: ["regraId"], equals: contexto.regraId }, decisao: null,
    } }),
  ]);
  const habilidadesSemTentativa = planosAprovados.reduce((total, p) => {
    const atividades = z.array(z.object({ habilidade: z.enum(HABILIDADES) })).min(1).max(4).parse(p.atividades);
    // Cancelar o restante da reserva não apaga as habilidades já realizadas.
    // Reserva sem realização cancelada volta a exigir providência no plano;
    // o prazo vencido, isoladamente, não cancela a tentativa nem o plano.
    const atendidas = new Set(p.reservasTentativa.flatMap(r => r.itens.filter(i => i.realizacao || !r.cancelamento).map(i => i.habilidade)));
    return total + new Set(atividades.filter(a => !atendidas.has(a.habilidade)).map(a => a.habilidade)).size;
  }, 0);
  return { correcoesRegulares, correcoesRecuperacao, planosAguardandoDecisao, planosSemDisponibilizacao, tentativasAguardandoRealizacao, habilidadesSemTentativa, oportunidadesExtrasAguardandoDecisao };
}
