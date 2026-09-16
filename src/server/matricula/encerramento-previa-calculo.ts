import { conferirCompensacoesEncerramento } from "./encerramento-compensacao-conferida";
import { conferirOutrasCobrancasEncerramento } from "./encerramento-outras-cobrancas";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { ErroRegra } from "@/server/_shared";
import type { consultarContextoEncerramento } from "./encerramento-contexto";
import { ConferenciaMensalEncerramentoSchema } from "./encerramento-previa-schema";
import { calcularAcertoMensalEncerramento } from "./encerramento-acerto";
import type { MultaEncerramentoSchema } from "./encerramento-multa";

type Contexto = NonNullable<Extract<Awaited<ReturnType<typeof consultarContextoEncerramento>>, { ok: true }>["dado"]>;

/** Componente mensal do acerto; conserva a origem e a conferência sem efetivar ajustes. */
export function calcularPreviaMensalConferida(contexto: Contexto, dataEfetiva: string, input: z.input<typeof ConferenciaMensalEncerramentoSchema>) {
  const d = ConferenciaMensalEncerramentoSchema.parse(input);
  if (contexto.matriculaId !== d.matriculaId) throw new ErroRegra("Conferência pertence a outra matrícula.");
  if (contexto.pendencias.length || !contexto.condicoes) throw new ErroRegra("Resolva as pendências contratuais antes de conferir a prévia mensal.");
  const condicoes = contexto.condicoes;
  if (condicoes.id !== d.condicoesId) throw new ErroRegra("A versão das condições mudou. Confira novamente.");
  const mensais = contexto.cobrancas.filter((c) => c.tipo === "MENSALIDADE");
  const ids = new Set(d.parcelas.map((p) => p.cobrancaId));
  if (ids.size !== d.parcelas.length || d.parcelas.length !== mensais.length || mensais.some((c) => !ids.has(c.id))) throw new ErroRegra("Confira todas as mensalidades da matrícula, sem repetir ou omitir cobranças.");
  const parcelas = mensais.map((c) => {
    const conferencia = d.parcelas.find((p) => p.cobrancaId === c.id)!;
    if (c.versao !== conferencia.versao) throw new ErroRegra("Uma cobrança mudou. Atualize a conferência.");
    if (c.conferencias.length || !c.coberturaInicio || !c.coberturaFim) throw new ErroRegra("Há mensalidades com pendências de cobertura ou conciliação.");
    return { contratoVersaoId: condicoes.id, cobrancaId: c.id, moeda: c.moeda, dataEfetiva,
      coberturaInicio: c.coberturaInicio, coberturaFim: c.coberturaFim,
      diaEncerramento: condicoes.regras.diaEncerramento, metodoDesconto: condicoes.regras.metodoDesconto,
      valorBase: conferencia.valorBase, descontoValido: conferencia.descontoValido, recebido: c.valorRecebido ?? "0.00",
      ...(c.valorLiquidadoCredito ? { creditoLiquidado: c.valorLiquidadoCredito } : {}),
    };
  });
  const regra = condicoes.regras.multa;
  let multa: z.input<typeof MultaEncerramentoSchema>;
  if (regra.tipo === "SEM_PREVISAO") {
    if (d.multa.tipo !== "SEM_PREVISAO") throw new ErroRegra("O contrato não prevê esta multa.");
    multa = { tipo: "SEM_PREVISAO", motivo: regra.motivo, contratoVersaoId: condicoes.id, moeda: contexto.moeda };
  } else {
    if (d.multa.tipo !== "APLICAR") throw new ErroRegra("Dispensa ou alteração da multa exige proposta e autorização específica.");
    const comum = { contratoVersaoId: condicoes.id, moeda: contexto.moeda, clausulaId: regra.clausulaId,
      condicoesAplicacao: regra.condicoesAplicacao, evidenciaAplicabilidade: d.multa.evidenciaAplicabilidade };
    if (regra.tipo === "VALOR_FIXO") {
      if (d.multa.baseCalculo !== undefined) throw new ErroRegra("Multa fixa não utiliza uma base percentual.");
      multa = { ...comum, tipo: "VALOR_FIXO", valor: regra.valor };
    } else {
      if (d.multa.baseCalculo === undefined) throw new ErroRegra("Confira o valor da base prevista na cláusula percentual.");
      multa = { ...comum, tipo: "PERCENTUAL", percentual: regra.percentual, descricaoBase: regra.descricaoBase, baseCalculo: d.multa.baseCalculo };
    }
  }
  const calculo = calcularAcertoMensalEncerramento({ matriculaId: contexto.matriculaId, contratoVersaoId: condicoes.id, moeda: contexto.moeda, dataEfetiva, parcelas, multa });
  const excecao = d.multa.tipo === "APLICAR" ? d.multa.excecao : undefined;
  const valorProposto = excecao ? new Prisma.Decimal(excecao.tipo === "DISPENSAR" ? 0 : excecao.valorProposto).toFixed(2) : null;
  const compensacaoFinanceira = conferirCompensacoesEncerramento(contexto, calculo);
  return {
    calculo,
    compensacaoFinanceira,
    outrasCobrancasConferidas: conferirOutrasCobrancasEncerramento(contexto, d.outrasCobrancas),
    propostaExcecaoMulta: excecao && valorProposto !== null ? {
      tipo: excecao.tipo, motivo: excecao.motivo, valorContratual: calculo.multa.valor, valorProposto,
      saldoPropostoSemCompensarCreditos: new Prisma.Decimal(calculo.saldoDevidoSemCompensarCreditos).minus(calculo.multa.valor).plus(valorProposto).toFixed(2),
      saldoPropostoAposCompensacao: compensacaoFinanceira.consolidado
        ? new Prisma.Decimal(compensacaoFinanceira.consolidado.saldoDevidoSemCompensarCreditos).minus(calculo.multa.valor).plus(valorProposto).toFixed(2)
        : null,
      exigeAprovacaoIndependente: true as const,
    } : null,
    origem: { condicoes, cobrancas: mensais, ajustes: contexto.ajustes, compensacoes: contexto.compensacoes }, conferencia: d,
    demaisCobrancas: contexto.cobrancas.filter((c) => c.tipo !== "MENSALIDADE"),
    alcance: "COMPONENTE_MENSAL" as const,
  };
}
