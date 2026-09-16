import { Prisma } from "@prisma/client";
import type { consultarContextoEncerramento } from "./encerramento-contexto";
import type { calcularAcertoMensalEncerramento } from "./encerramento-acerto";
import { calcularCompensacaoPendenteEncerramento } from "./encerramento-compensacao";

type Contexto = NonNullable<Extract<Awaited<ReturnType<typeof consultarContextoEncerramento>>, { ok: true }>["dado"]>;
type Acerto = ReturnType<typeof calcularAcertoMensalEncerramento>;

/** Apuração por cobrança original, sem usar crédito, liquidar direitos ou executar o encerramento. */
export function conferirCompensacoesEncerramento(contexto: Contexto, mensal: Acerto) {
  const pendencias: string[] = [];
  const ajustes: { cobrancaId: string; compensacaoIds: string[];
    apuracao: ReturnType<typeof calcularCompensacaoPendenteEncerramento>;
    valorServicoAposCompensacao: string; saldoDevido: string; creditoApurado: string }[] = [];
  for (const proposta of contexto.compensacoes.filter((c) => c.status === "PENDENTE")) {
    pendencias.push(`Compensação ${proposta.id} aguarda decisão.`);
  }
  const aprovadas = contexto.compensacoes.filter((c) => c.status === "APROVADA");
  for (const cobrancaId of new Set(aprovadas.map((c) => c.cobrancaOrigemId))) {
    const origens = aprovadas.filter((c) => c.cobrancaOrigemId === cobrancaId);
    const primeira = origens[0];
    const parcela = mensal.parcelas.find((p) => p.cobrancaId === cobrancaId);
    if (!parcela || origens.some((c) => c.moeda !== mensal.moeda || c.coberturaOriginalInicio !== parcela.coberturaInicio || c.coberturaOriginalFim !== parcela.coberturaFim || c.valorCoberturaOriginal !== primeira.valorCoberturaOriginal)) {
      pendencias.push(`Concilie a cobertura e o valor original das compensações da cobrança ${cobrancaId}.`);
      continue;
    }
    const dias = origens.flatMap((c) => c.dias);
    if (new Set(dias.map((d) => d.diaOrigem)).size !== dias.length) {
      pendencias.push(`Dias duplicados nas compensações da cobrança ${cobrancaId}.`);
      continue;
    }
    // Apenas dias ainda sem destinação podem já ter sido retirados pelo proporcional.
    const contemplados = dias.filter((d) => d.estado === "PENDENTE" && (!parcela.ultimoDiaCoberto || d.diaOrigem > parcela.ultimoDiaCoberto));
    const apuracao = calcularCompensacaoPendenteEncerramento({
      matriculaId: contexto.matriculaId, condicoesId: mensal.contratoVersaoId, cobrancaOrigemId: cobrancaId,
      compensacaoId: primeira.id, moeda: mensal.moeda,
      coberturaOriginalInicio: primeira.coberturaOriginalInicio, coberturaOriginalFim: primeira.coberturaOriginalFim,
      valorCoberturaOriginalConferido: primeira.valorCoberturaOriginal, regraCalculo: "DIAS_REAIS_PERIODO_ORIGEM",
      evidenciaCondicoes: origens.map((c) => c.evidenciaCondicoes).join("; ").slice(0, 2000),
      diasIndisponiveis: dias.map((d) => d.diaOrigem),
      diasRecompostos: dias.filter((d) => d.estado === "RECOMPOSTO").map((d) => d.diaOrigem),
      diasLiquidadosFinanceiramente: dias.filter((d) => d.estado === "LIQUIDADO_FINANCEIRAMENTE").map((d) => d.diaOrigem),
      diasContempladosNoProporcional: contemplados.map((d) => d.diaOrigem),
    });
    const devido = new Prisma.Decimal(parcela.valorDevido).minus(apuracao.valorAjusteApurado);
    if (devido.isNegative()) {
      pendencias.push(`A compensação supera o serviço apurado na cobrança ${cobrancaId}; confira descontos e ajustes anteriores.`);
      continue;
    }
    const recebido = new Prisma.Decimal(parcela.recebido).plus(parcela.creditoLiquidado ?? 0);
    ajustes.push({ cobrancaId, compensacaoIds: origens.map((c) => c.id), apuracao,
      valorServicoAposCompensacao: devido.toFixed(2),
      saldoDevido: Prisma.Decimal.max(0, devido.minus(recebido)).toFixed(2),
      creditoApurado: Prisma.Decimal.max(0, recebido.minus(devido)).toFixed(2),
    });
  }
  const parcelas = mensal.parcelas.map((p) => {
    const ajuste = ajustes.find((a) => a.cobrancaId === p.cobrancaId);
    return { cobrancaId: p.cobrancaId, valorServico: ajuste?.valorServicoAposCompensacao ?? p.valorDevido,
      saldoDevido: ajuste?.saldoDevido ?? p.saldoDevido, creditoApurado: ajuste?.creditoApurado ?? p.creditoApurado };
  });
  const soma = (campo: "valorServico" | "saldoDevido" | "creditoApurado") => parcelas.reduce((total, p) => total.plus(p[campo]), new Prisma.Decimal(0));
  return { ajustes, pendencias, completo: pendencias.length === 0,
    consolidado: pendencias.length ? null : {
      parcelas, totalServico: soma("valorServico").toFixed(2), multaContratual: mensal.multa.valor,
      saldoDevidoSemCompensarCreditos: soma("saldoDevido").plus(mensal.multa.valor).toFixed(2),
      creditoApuradoSemUtilizacao: soma("creditoApurado").toFixed(2),
    },
  };
}
