import { Prisma } from "@prisma/client";
import { z } from "zod";
import { ErroRegra } from "@/server/_shared";
import { apurarDiasIndisponibilidadeCoberturaTx } from "./apuracao-indisponibilidade-cobertura";
import { apurarRegularizacaoPeriodoIntegral } from "./apuracao-periodo-integral";
import { hashSubstituicao } from "@/server/contratos/substituicao-estado";

const Entrada = z.object({ matriculaId: z.string().min(1), cobrancaId: z.string().min(1), escolha: z.enum(["CREDITO", "COBERTURA_FUTURA"]) }).strict();

/** Fonte transacional da proposta Q67. Não autoriza ajuste ou escolha em nome do aluno. */
export async function carregarPeriodoIntegralTx(tx: Prisma.TransactionClient, input: z.input<typeof Entrada>) {
  const d = Entrada.parse(input);
  const c = await tx.cobranca.findFirst({ where: { id: d.cobrancaId, matriculaId: d.matriculaId }, include: {
    matricula: true, destinacoesRecebimento: { orderBy: { id: "asc" }, include: { recebimento: true } },
    informes: { where: { status: "A_CONFERIR" }, select: { id: true } }, ajusteAcerto: { select: { id: true } },
  } });
  if (!c || c.tipo !== "MENSALIDADE" || c.status === "CANCELADA" || !c.coberturaInicio || !c.coberturaFim || c.suspensaPorItemPausaId || c.canceladaPorPausaId || c.ajusteAcerto) {
    throw new ErroRegra("Confira a mensalidade e seus ajustes antes de regularizar o período integral.");
  }
  const m = c.matricula;
  if (!["ATIVA", "PAUSADA"].includes(m.status) || !m.contratoOk || !m.contratoDocumentoId || !m.confirmacaoContratoEm || !m.confirmacaoContratoPorId || m.moeda !== c.moeda) {
    throw new ErroRegra("A regularização exige matrícula e contrato conferidos na mesma moeda.");
  }
  const documento = await tx.documento.findFirst({ where: { id: m.contratoDocumentoId, categoria: "CONTRATO", arquivado: false,
    OR: [{ matriculaId: m.id }, ...(m.leadId ? [{ leadId: m.leadId }] : [])],
  }, select: { id: true } });
  if (!documento || c.informes.length) throw new ErroRegra("Confira o documento contratual e os comprovantes pendentes antes da regularização.");
  const direitoAnterior = await tx.diaCompensacaoCobertura.findFirst({ where: { matriculaId: m.id,
    diaOrigem: { gte: c.coberturaInicio, lte: c.coberturaFim } }, select: { id: true } });
  const propostaParcial = await tx.compensacaoCoberturaMatricula.findFirst({ where: { cobrancaOrigemId: c.id, status: { in: ["PENDENTE", "APROVADA"] } }, select: { id: true } });
  if (direitoAnterior || propostaParcial) throw new ErroRegra("Há compensação parcial reconhecida ou em análise; confira seus efeitos antes de regularizar o período inteiro.");
  const apuracao = await apurarDiasIndisponibilidadeCoberturaTx(tx, { matriculaId: m.id, inicio: c.coberturaInicio, fim: c.coberturaFim });
  if (apuracao.classificacao !== "INTEGRAL") throw new ErroRegra("O período inteiro precisa ter indisponibilidade da escola confirmada.");
  const fontes = await tx.registroIndisponibilidadeOfertaMatricula.findMany({ where: { matriculaId: m.id,
    inicio: { lte: c.coberturaFim }, OR: [{ fim: null }, { fim: { gte: c.coberturaInicio } }], confirmacao: { is: { confirmada: true } } },
    orderBy: { id: "asc" }, take: 1001, select: { id: true, inicio: true, fim: true,
      confirmacao: { select: { id: true } }, propostasTermino: { where: { decisao: { is: { aprovada: true } } }, take: 1, select: { id: true, fim: true, decisao: { select: { id: true } } } } } });
  if (fontes.length > 1000) throw new ErroRegra("Confira o volume de fontes antes de preservar a proposta integral.");
  const usos = await tx.propostaUsoCredito.findMany({ where: { cobrancaId: c.id, decisao: { is: { aprovada: true } } },
    orderBy: { id: "asc" }, select: { id: true, creditoId: true, valor: true, credito: { select: { matriculaId: true, moeda: true } } } });
  const liquidado = usos.reduce((soma, uso) => soma.plus(uso.valor), new Prisma.Decimal(0));
  if (!liquidado.equals(c.valorLiquidadoCredito) || usos.some(uso => uso.credito.matriculaId !== m.id || uso.credito.moeda !== c.moeda)) {
    throw new ErroRegra("O crédito aplicado à mensalidade não corresponde às utilizações aprovadas desta matrícula.");
  }
  const memoria = apurarRegularizacaoPeriodoIntegral({
    cobrancaId: c.id, matriculaId: m.id, moeda: c.moeda, escolha: d.escolha,
    valorOriginal: c.valorOriginal.toFixed(2), valorNegociado: c.valorNegociado.toFixed(2),
    valorRecebido: (c.valorRecebido ?? new Prisma.Decimal(0)).toFixed(2), valorLiquidadoCredito: c.valorLiquidadoCredito.toFixed(2),
    saldoRegistrado: c.saldo?.toFixed(2) ?? null,
    recebimentos: c.destinacoesRecebimento.map(d => ({ id: d.id, recebimentoId: d.recebimento.id, valor: d.valor.toFixed(2), moeda: d.recebimento.moeda })),
    cobertura: { inicio: c.coberturaInicio.toISOString().slice(0, 10), fim: c.coberturaFim.toISOString().slice(0, 10) },
    diasConfirmados: apuracao.diasConfirmados,
  });
  const snapshot = {
    matriculaId: m.id, cobrancaId: c.id, cobrancaVersao: c.versao, documentoId: documento.id,
    statusMatricula: m.status, contratoConfirmadoEm: m.confirmacaoContratoEm.toISOString(), contratoConfirmadoPorId: m.confirmacaoContratoPorId,
    statusCobranca: c.status, vencimento: c.vencimento.toISOString(), memoria,
    recebimentos: c.destinacoesRecebimento.map(d => ({ id: d.id, recebimentoId: d.recebimento.id, valor: d.valor.toFixed(2), moeda: d.recebimento.moeda, dataPagamento: d.recebimento.dataPagamento.toISOString() })),
    fontes: fontes.filter(f => (f.propostasTermino[0]?.fim ?? f.fim ?? c.coberturaFim!) >= c.coberturaInicio!).map(f => ({
      relatoId: f.id, confirmacaoId: f.confirmacao!.id, inicio: f.inicio.toISOString().slice(0, 10),
      fim: (f.propostasTermino[0]?.fim ?? f.fim)?.toISOString().slice(0, 10) ?? null,
      terminoPropostaId: f.propostasTermino[0]?.id ?? null, terminoDecisaoId: f.propostasTermino[0]?.decisao?.id ?? null,
    })),
    usosCredito: usos.map(uso => ({ id: uso.id, creditoId: uso.creditoId, valor: uso.valor.toFixed(2) })),
  };
  return { snapshot, hash: hashSubstituicao(snapshot) };
}
