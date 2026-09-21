import { Prisma } from "@prisma/client";
import { z } from "zod";
import { ErroRegra } from "@/server/_shared";
import type { consultarContextoEncerramento } from "./encerramento-contexto";

type Contexto = NonNullable<Extract<Awaited<ReturnType<typeof consultarContextoEncerramento>>, { ok: true }>["dado"]>;
import { OutrasCobrancasEncerramentoSchema } from "./encerramento-outras-cobrancas-schema";

/** Confere somente cobranças já emitidas; não converte saldo de horas nem executa crédito. */
export function conferirOutrasCobrancasEncerramento(contexto: Contexto, input?: z.input<typeof OutrasCobrancasEncerramentoSchema>) {
  const origens = contexto.cobrancas.filter((c) => c.tipo !== "MENSALIDADE");
  if (input === undefined && origens.length) return { pendencias: ["Confira as demais cobranças emitidas antes de consolidar o acerto."], parcelas: [], consolidado: null };
  const conferencias = OutrasCobrancasEncerramentoSchema.parse(input ?? []);
  const ids = new Set(conferencias.map((c) => c.cobrancaId));
  if (ids.size !== conferencias.length || ids.size !== origens.length || origens.some((c) => !ids.has(c.id))) throw new ErroRegra("Confira todas as demais cobranças, sem omissões, repetições ou mensalidades.");
  const parcelas = origens.map((c) => {
    const proposta = conferencias.find((p) => p.cobrancaId === c.id)!;
    if (proposta.versao !== c.versao) throw new ErroRegra("Uma das demais cobranças mudou. Atualize a conferência.");
    if (c.conferencias.length || c.moeda !== contexto.moeda) throw new ErroRegra("Concilie as pendências das demais cobranças antes do acerto.");
    const devido = new Prisma.Decimal(proposta.valorDevidoProposto), recebido = new Prisma.Decimal(c.valorRecebido ?? 0);
    const detalhes = c.recebimentos.reduce((total, r) => total.plus(r.valor), new Prisma.Decimal(0));
    const credito = new Prisma.Decimal(c.valorLiquidadoCredito ?? 0);
    const liquidado = recebido.plus(credito);
    if (recebido.isNegative() || !detalhes.equals(recebido) || c.recebimentos.some((r) => r.moeda !== c.moeda || new Prisma.Decimal(r.valor).isNegative())) throw new ErroRegra("Os recebimentos detalhados exigem conciliação.");
    return { cobrancaId: c.id, tipo: c.tipo, moeda: c.moeda, versao: c.versao, valorOriginal: c.valorNegociado,
      ...(c.origemFaturamentoHoras ? { origemFaturamentoHoras: c.origemFaturamentoHoras } : {}),
      valorDevidoProposto: devido.toFixed(2), valorRecebido: recebido.toFixed(2),
      ...(credito.gt(0) ? { valorLiquidadoCredito: credito.toFixed(2), utilizacoesCredito: c.utilizacoesCredito } : {}),
      saldoDevido: Prisma.Decimal.max(0, devido.minus(liquidado)).toFixed(2), creditoApurado: Prisma.Decimal.max(0, liquidado.minus(devido)).toFixed(2),
      alteracaoProposta: !devido.equals(c.valorNegociado), motivo: proposta.motivo, evidenciaContratual: proposta.evidenciaContratual,
      recebimentos: c.recebimentos, exigeAprovacaoIndependente: true as const };
  });
  const somar = (campo: "saldoDevido" | "creditoApurado") => parcelas.reduce((soma, p) => soma.plus(p[campo]), new Prisma.Decimal(0)).toFixed(2);
  return { pendencias: [], parcelas, consolidado: { moeda: contexto.moeda, saldoDevidoSemCompensarCreditos: somar("saldoDevido"), creditoApurado: somar("creditoApurado") } };
}
