import { Prisma } from "@prisma/client";
import { carregarFinanceiroDesistenciaTx } from "./desistencia-financeiro-tx";
import { saldoCreditoTx } from "@/server/financeiro/uso-credito-estado";
import type { FatoDelta, ObrigacaoDelta } from "./desistencia-reconferencia-delta-calculo";

type ItemMemoriaBase = { cobrancaId: string; devido: string; moeda: string };
type MemoriaBase = { itens: ItemMemoriaBase[] };
type RecebimentoFoto = { id: string; recebimentoId: string; valor: string; moeda: string };
type InformeFoto = { id: string; status: string; valor: string; moeda: string };
type CobrancaFoto = {
  id: string; moeda: string; valorNegociado: string; saldo: string | null;
  valorLiquidadoCredito: string; valorCompensadoPermuta?: string;
  informes: InformeFoto[]; recebimentos: RecebimentoFoto[];
};
type CreditoFoto = {
  id: string; valorInicial: string; moeda: string;
  origemDestinacaoRecebimentoId: string | null;
  origemLiberacaoId: string | null; origemAcertoId: string | null;
  origemPeriodoIntegralId: string | null; origemAcertoTaxaAditivoId: string | null;
  origemAcertoDesistenciaContratualId: string | null;
  origemReconferenciaDeltaDesistenciaId: string | null;
  origemRevisaoCorrecaoAulaId?: string | null;
  origemExcedentePermutaId?: string | null;
};
type FotoFinanceira = { matriculaId: string; cobrancas: CobrancaFoto[]; creditos: CreditoFoto[] };
type OrigemPorCobranca = { cobrancaId: string; valor: Prisma.Decimal; moeda: string };

const valor = (valor: unknown, campo: string) => {
  if (typeof valor !== "string" || !/^\d{1,10}\.\d{2}$/.test(valor)) {
    throw new Error(`${campo} inválido na fonte financeira.`);
  }
  return new Prisma.Decimal(valor);
};
const id = (valor: unknown, campo: string) => {
  if (typeof valor !== "string" || !valor.trim() || valor.length > 100) {
    throw new Error(`${campo} inválido na fonte financeira.`);
  }
  return valor;
};
const moeda = (valor: unknown, campo: string) => {
  if (typeof valor !== "string" || !/^[A-Z]{3}$/.test(valor)) {
    throw new Error(`${campo} inválida na fonte financeira.`);
  }
  return valor;
};

function lerMemoria(memoria: unknown): Record<string, ObrigacaoDelta> {
  if (!memoria || typeof memoria !== "object" || !Array.isArray((memoria as MemoriaBase).itens)) {
    throw new Error("Memória Q165 base ausente.");
  }
  const obrigacoes: Record<string, ObrigacaoDelta> = {};
  for (const item of (memoria as MemoriaBase).itens) {
    const cobrancaId = id(item?.cobrancaId, "Cobrança da memória");
    if (obrigacoes[cobrancaId]) throw new Error("A memória Q165 base repete uma cobrança.");
    obrigacoes[cobrancaId] = {
      devido: valor(item?.devido, "Valor devido da memória").toFixed(2),
      moeda: moeda(item?.moeda, "Moeda da memória"),
    };
  }
  if (!Object.keys(obrigacoes).length) throw new Error("Memória Q165 base ausente.");
  return obrigacoes;
}

function classificarCredito(credito: CreditoFoto, saldoDisponivel: Prisma.Decimal) {
  id(credito.id, "Crédito");
  const moedaCredito = moeda(credito.moeda, "Moeda do crédito");
  valor(credito.valorInicial, "Valor inicial do crédito");
  if (saldoDisponivel.isNegative()) throw new Error("Saldo disponível do crédito inválido.");
  const origens = [
    credito.origemDestinacaoRecebimentoId ?? null, credito.origemLiberacaoId ?? null, credito.origemAcertoId ?? null,
    credito.origemPeriodoIntegralId ?? null, credito.origemAcertoTaxaAditivoId ?? null,
    credito.origemAcertoDesistenciaContratualId ?? null, credito.origemReconferenciaDeltaDesistenciaId ?? null,
    credito.origemRevisaoCorrecaoAulaId ?? null, credito.origemExcedentePermutaId ?? null,
  ];
  if (origens.some(origem => origem !== null && (typeof origem !== "string" || !origem.trim()))) {
    throw new Error("Origem do crédito inválida na fonte financeira.");
  }
  if (origens.every(origem => origem === null)) throw new Error("Crédito sem origem auditável na fonte financeira.");
  const detalhe = { id: credito.id, saldoDisponivel: saldoDisponivel.toFixed(2), moeda: moedaCredito };
  const origemDoAcerto = credito.origemAcertoDesistenciaContratualId != null || credito.origemReconferenciaDeltaDesistenciaId != null;
  return origemDoAcerto ? { tipo: "DO_ACERTO" as const, ...detalhe }
    : { tipo: "EXTERNO_AO_ACERTO" as const, ...detalhe };
}

/** Lê o ledger Q121: caixa vem de destinações reais, e informes jamais subtraem caixa. */
export async function carregarFontesReconferenciaDeltaTx(
  tx: Prisma.TransactionClient,
  matriculaId: string,
  memoriaBase: unknown,
) {
  id(matriculaId, "Matrícula");
  const obrigacoes = lerMemoria(memoriaBase);
  const financeiro = await carregarFinanceiroDesistenciaTx(tx, matriculaId);
  const foto = financeiro.snapshot as unknown as FotoFinanceira;
  if (!foto || foto.matriculaId !== matriculaId || !Array.isArray(foto.cobrancas) || !Array.isArray(foto.creditos)) {
    throw new Error("Fotografia financeira Q121 inválida.");
  }

  const idsCredito = foto.creditos.map(credito => id(credito?.id, "Crédito"));
  const origensTaxa = await tx.creditoMatricula.findMany({
    where: { id: { in: idsCredito } }, select: { id: true, origemAcertoTaxaAditivoId: true },
  });
  const origemTaxaPorCredito = new Map(origensTaxa.map(credito => [credito.id, credito.origemAcertoTaxaAditivoId]));
  const creditosFoto = foto.creditos.map(credito => ({
    ...credito, origemAcertoTaxaAditivoId: credito.origemAcertoTaxaAditivoId ?? origemTaxaPorCredito.get(credito.id) ?? null,
  }));
  const txDelta = tx as unknown as {
    origemCreditoAcertoDesistenciaContratual: { findMany(args: unknown): Promise<OrigemPorCobranca[]> };
    origemCreditoReconferenciaDeltaDesistencia: { findMany(args: unknown): Promise<OrigemPorCobranca[]> };
  };
  const [origensBase, origensDelta] = await Promise.all([
    txDelta.origemCreditoAcertoDesistenciaContratual.findMany({ where: { matriculaId }, select: { cobrancaId: true, valor: true, moeda: true } }),
    txDelta.origemCreditoReconferenciaDeltaDesistencia.findMany({ where: { matriculaId }, select: { cobrancaId: true, valor: true, moeda: true } }),
  ]);
  const porCobranca = new Map<string, Prisma.Decimal>();
  const cobrancas = new Map<string, CobrancaFoto>();
  for (const cobranca of foto.cobrancas) {
    const cobrancaId = id(cobranca?.id, "Cobrança");
    if (cobrancas.has(cobrancaId)) throw new Error("Fotografia financeira repete uma cobrança.");
    moeda(cobranca.moeda, "Moeda da cobrança");
    valor(cobranca.valorNegociado, "Valor negociado");
    valor(cobranca.saldo ?? "0.00", "Saldo da cobrança");
    valor(cobranca.valorLiquidadoCredito, "Liquidação por crédito");
    valor(cobranca.valorCompensadoPermuta ?? "0.00", "Permuta");
    cobrancas.set(cobrancaId, cobranca);
    porCobranca.set(cobrancaId, new Prisma.Decimal(0));
  }
  for (const origem of [...origensBase, ...origensDelta]) {
    const cobranca = cobrancas.get(id(origem.cobrancaId, "Cobrança da origem"));
    if (!cobranca) throw new Error("Origem de crédito não pertence à matrícula conferida.");
    if (moeda(origem.moeda, "Moeda da origem") !== cobranca.moeda) {
      throw new Error("Moeda da origem de crédito diverge da cobrança.");
    }
    porCobranca.set(cobranca.id, porCobranca.get(cobranca.id)!.plus(origem.valor));
  }

  const fatos: FatoDelta[] = foto.cobrancas.map(cobranca => {
    const recebimentos = cobranca.recebimentos ?? [];
    if (!Array.isArray(recebimentos) || !Array.isArray(cobranca.informes)) throw new Error("Destinações da cobrança inválidas.");
    const idsRecebimento = new Set<string>();
    const caixa = recebimentos.reduce((total, recebimento) => {
      const recebimentoId = id(recebimento?.id, "Destinação de recebimento");
      if (idsRecebimento.has(recebimentoId)) throw new Error("Destinação de recebimento repetida.");
      idsRecebimento.add(recebimentoId);
      if (id(recebimento.recebimentoId, "Recebimento") === recebimentoId || moeda(recebimento.moeda, "Moeda do recebimento") !== cobranca.moeda) {
        throw new Error("Destinação de recebimento inválida para a cobrança.");
      }
      return total.plus(valor(recebimento.valor, "Valor destinado do recebimento"));
    }, new Prisma.Decimal(0));
    const informePendente = cobranca.informes.some(informe => {
      id(informe?.id, "Informe");
      valor(informe.valor, "Valor do informe");
      if (moeda(informe.moeda, "Moeda do informe") !== cobranca.moeda || typeof informe.status !== "string") {
        throw new Error("Informe inválido para a cobrança.");
      }
      return informe.status === "A_CONFERIR";
    });
    return {
      cobrancaId: cobranca.id, moeda: cobranca.moeda, devidoAtual: cobranca.valorNegociado,
      saldoAtual: cobranca.saldo ?? "0.00",
      liquidado: caixa.plus(cobranca.valorLiquidadoCredito).toFixed(2),
      creditoJaApurado: porCobranca.get(cobranca.id)!.toFixed(2),
      informePendente, permuta: cobranca.valorCompensadoPermuta ?? "0.00",
    };
  });
  const creditosClassificados = await Promise.all(creditosFoto.map(async credito =>
    classificarCredito(credito, await saldoCreditoTx(tx, credito.id)),
  ));
  if (new Set(creditosClassificados.map(credito => credito.id)).size !== creditosClassificados.length) {
    throw new Error("Fotografia financeira repete um crédito.");
  }
  const creditosExternos = creditosClassificados
    .filter((credito): credito is Extract<typeof credito, { tipo: "EXTERNO_AO_ACERTO" }> => credito.tipo === "EXTERNO_AO_ACERTO")
    .map(({ tipo: _tipo, ...credito }) => credito);
  const creditosDoAcerto = creditosClassificados
    .filter((credito): credito is Extract<typeof credito, { tipo: "DO_ACERTO" }> => credito.tipo === "DO_ACERTO")
    .map(({ tipo: _tipo, ...credito }) => credito);
  // Esta fotografia é exclusiva da reconferência. Q121 continua preservando
  // apenas valor inicial e origem, enquanto Q165.249 precisa detectar uso ou
  // reserva posterior que reduz o saldo disponível do crédito.
  const saldos = new Map(creditosClassificados.map(credito => [credito.id, credito.saldoDisponivel]));
  const fotografia = { ...foto, creditos: creditosFoto.map(credito => ({
    ...credito, saldoDisponivel: saldos.get(credito.id)!,
  })) } as unknown as Prisma.JsonObject;
  return { fatos, obrigacoes, creditosExternos, creditosDoAcerto, fotografia };
}
