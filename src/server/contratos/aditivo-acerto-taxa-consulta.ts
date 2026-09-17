"use server";

import { Papel, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { executarAcao, exigirSessaoComPapel, ErroRegra } from "@/server/_shared";
import { carregarEstadoConferenciaFinalAditivoTx } from "./aditivo-conferencia-final-estado";
import { calcularCreditoAcertoTaxa } from "./aditivo-acerto-taxa-calculo";
import { ConsultarAlvosAcertoTaxaAditivoSchema } from "./aditivo-acerto-taxa-schema";

/**
 * Prévia somente de leitura. Cada linha continua exigindo escolha explícita da
 * cobrança existente: esta consulta nunca seleciona uma "primeira futura".
 */
export async function consultarAlvosAcertoTaxaAditivo(input: unknown) {
  return executarAcao(async () => {
    await exigirSessaoComPapel(Papel.SECRETARIA_ACADEMICA, Papel.FINANCEIRO, Papel.ADMINISTRADOR);
    const d = ConsultarAlvosAcertoTaxaAditivoSchema.parse(input);
    return prisma.$transaction(async tx => {
      const estado = await carregarEstadoConferenciaFinalAditivoTx(tx, d);
      if (estado.revisaoHash !== d.revisaoHash) throw new ErroRegra("A conferência final mudou; atualize a prévia do aditivo.");
      const versao = await tx.versaoCondicoesAditivo.findFirst({
        where: { matriculaId: d.matriculaId, propostaId: d.propostaId },
        select: { id: true, condicoes: true, condicoesHash: true, conferenciaFinal: { select: { conclusaoId: true } } },
      });
      if (!versao || versao.conferenciaFinal.conclusaoId !== d.conclusaoId) {
        return { estado: "CONDICOES_NAO_FORMALIZADAS" as const, mensagem: "A taxa só pode ser preparada depois de formalizar as condições do aditivo." };
      }
      const condicoes = versao.condicoes as Record<string, unknown>;
      const taxaValor = condicoes.TAXA_VALOR as { tipo?: string; valor?: string; moeda?: string } | undefined;
      const taxaVencimento = condicoes.TAXA_VENCIMENTO as { tipo?: string; data?: string } | undefined;
      if (!taxaValor && !taxaVencimento) return { estado: "SEM_TAXA" as const, mensagem: "Esta versão formalizada não altera valor ou vencimento da taxa." };
      if (taxaValor && (taxaValor.tipo !== "DINHEIRO" || typeof taxaValor.valor !== "string" || typeof taxaValor.moeda !== "string")) throw new ErroRegra("A condição TAXA_VALOR formalizada está inválida.");
      if (taxaVencimento && (taxaVencimento.tipo !== "DATA" || typeof taxaVencimento.data !== "string")) throw new ErroRegra("A condição TAXA_VENCIMENTO formalizada está inválida.");
      const cobrancas = await tx.cobranca.findMany({
        where: { matriculaId: d.matriculaId, tipo: "MATRICULA" },
        orderBy: [{ vencimento: "asc" }, { id: "asc" }],
        select: { id: true, codigo: true, versao: true, status: true, moeda: true, valorOriginal: true, valorNegociado: true, valorRecebido: true, valorLiquidadoCredito: true, saldo: true, vencimento: true, recebimentos: { select: { id: true } }, informes: { where: { status: "A_CONFERIR" }, select: { id: true } }, utilizacoesCreditoPropostas: { select: { id: true } }, compensacoesCobertura: { select: { id: true } }, ajusteAcerto: { select: { id: true } }, suspensaPorItemPausaId: true, canceladaPorPausaId: true },
      });
      const creditosPorCobranca = cobrancas.length === 0 ? [] : await tx.$queryRaw<Array<{ cobrancaId: string; total: Prisma.Decimal }>>(Prisma.sql`
        SELECT "cobrancaId", coalesce(sum(valor), 0)::numeric AS total
        FROM "OrigemCreditoAcertoTaxaAditivo"
        WHERE "cobrancaId" IN (${Prisma.join(cobrancas.map(c => c.id))})
        GROUP BY "cobrancaId"
      `);
      const creditoAnterior = new Map(creditosPorCobranca.map(c => [c.cobrancaId, c.total]));
      return {
        estado: "PRONTA_PARA_SELECAO" as const,
        versaoCondicoesId: versao.id,
        condicoesHash: versao.condicoesHash,
        cobrancas: cobrancas.map(c => {
          const valorNovo = taxaValor?.valor ? new Prisma.Decimal(taxaValor.valor) : c.valorNegociado;
          const memoria = calcularCreditoAcertoTaxa({ valorRecebido: c.valorRecebido, valorLiquidadoCredito: c.valorLiquidadoCredito, valorNovo, creditosTaxaJaOriginados: creditoAnterior.get(c.id) ?? 0 });
          return {
            id: c.id, codigo: c.codigo, versao: c.versao, status: c.status, moeda: c.moeda,
            valorOriginal: c.valorOriginal.toFixed(2), valorNegociado: c.valorNegociado.toFixed(2), valorRecebido: c.valorRecebido?.toFixed(2) ?? null, valorLiquidadoCredito: c.valorLiquidadoCredito.toFixed(2), saldo: c.saldo?.toFixed(2) ?? null, vencimento: c.vencimento.toISOString().slice(0, 10),
            valorNovo: valorNovo.toFixed(2), vencimentoNovo: taxaVencimento ? taxaVencimento.data : c.vencimento.toISOString().slice(0, 10), creditoAnterior: memoria.creditoAnterior.toFixed(2), creditoNovo: memoria.creditoNovo.toFixed(2), creditoTotalDevido: memoria.creditoTotalDevido.toFixed(2), saldoAposAcerto: memoria.saldoAposAcerto.toFixed(2), pendencia: memoria.pendencia && { codigo: memoria.pendencia.codigo, valor: memoria.pendencia.valor.toFixed(2), tratamento: memoria.pendencia.tratamento },
            movimento: { recebimentos: c.recebimentos.length, informesAtivos: c.informes.length, usosCredito: c.utilizacoesCreditoPropostas.length, compensacoes: c.compensacoesCobertura.length, ajusteAcertoId: c.ajusteAcerto?.id ?? null, suspensaPorPausaId: c.suspensaPorItemPausaId, canceladaPorPausaId: c.canceladaPorPausaId },
          };
        }),
      };
    }, { isolationLevel: "RepeatableRead" });
  });
}
