import { Prisma } from "@prisma/client";

/** Valores cumulativos conferidos no ledger da cobrança, nunca no formulário. */
export type FatoDelta = {
  cobrancaId: string;
  moeda: string;
  devidoAtual: string;
  saldoAtual: string;
  liquidado: string;
  creditoJaApurado: string;
  informePendente: boolean;
  permuta: string;
};
export type ObrigacaoDelta = { devido: string; moeda: string };
export type ItemDelta = {
  cobrancaId: string;
  moeda: string;
  devidoAlvo: string;
  saldoAlvo: string;
  ajusteDevido: string;
  ajusteSaldo: string;
  creditoDelta: string;
  reducaoCredito: string;
};
type ResultadoDelta =
  | { tipo: "PENDENCIA"; motivo: string; itens: ItemDelta[] }
  | { tipo: "SEM_EFEITO" | "APLICAR"; itens: ItemDelta[] };

function valor(texto: string): Prisma.Decimal {
  if (!/^\d{1,10}\.\d{2}$/.test(texto)) throw new Error("Valor financeiro inválido.");
  return new Prisma.Decimal(texto);
}

/** A obrigação aprovada continua ancorada na memória original. Rejeitar um
 * informe não remove recebimentos reais; o carregador apenas exclui o informe
 * do total liquidado. Crédito sem destinação não liquida nenhuma cobrança e
 * deve ser reconhecido separadamente por ID, sem rateio implícito aqui. */
export function calcularReconferenciaDelta(
  fatos: FatoDelta[],
  obrigacoes: Record<string, ObrigacaoDelta>,
  fotoAnteriorHash: string,
  fotoAtualHash: string,
): ResultadoDelta {
  if (![fotoAnteriorHash, fotoAtualHash].every(hash => /^[a-f0-9]{64}$/.test(hash))) {
    throw new Error("Fotografia financeira inválida.");
  }
  const ids = new Set<string>();
  for (const fato of fatos) {
    if (!fato.cobrancaId || ids.has(fato.cobrancaId) || !/^[A-Z]{3}$/.test(fato.moeda)
      || typeof fato.informePendente !== "boolean") throw new Error("Fonte financeira inválida.");
    ids.add(fato.cobrancaId);
    [fato.devidoAtual, fato.saldoAtual, fato.liquidado, fato.creditoJaApurado, fato.permuta].forEach(valor);
  }
  if (Object.keys(obrigacoes).length !== ids.size || fatos.some(fato => !Object.hasOwn(obrigacoes, fato.cobrancaId))) {
    return { tipo: "PENDENCIA", motivo: "As cobranças não correspondem à memória contratual aprovada.", itens: [] };
  }
  for (const fato of fatos) {
    const obrigacao = obrigacoes[fato.cobrancaId];
    valor(obrigacao.devido);
    if (obrigacao.moeda !== fato.moeda) throw new Error("Moeda divergente da obrigação aprovada.");
  }
  if (fatos.some(fato => fato.informePendente)) {
    return { tipo: "PENDENCIA", motivo: "Há informe de pagamento pendente de conferência.", itens: [] };
  }
  if (fatos.some(fato => valor(fato.permuta).gt(0))) {
    return { tipo: "PENDENCIA", motivo: "Permuta exige destinação negociada própria.", itens: [] };
  }
  const itens = fatos.map(fato => {
    const devido = valor(obrigacoes[fato.cobrancaId].devido);
    const liquidado = valor(fato.liquidado);
    const saldo = Prisma.Decimal.max(devido.minus(liquidado), 0);
    const excedente = Prisma.Decimal.max(liquidado.minus(devido), 0);
    const diferencaCredito = excedente.minus(valor(fato.creditoJaApurado));
    return {
      cobrancaId: fato.cobrancaId, moeda: fato.moeda,
      devidoAlvo: devido.toFixed(2), saldoAlvo: saldo.toFixed(2),
      ajusteDevido: devido.minus(valor(fato.devidoAtual)).toFixed(2),
      ajusteSaldo: saldo.minus(valor(fato.saldoAtual)).toFixed(2),
      creditoDelta: Prisma.Decimal.max(diferencaCredito, 0).toFixed(2),
      reducaoCredito: Prisma.Decimal.max(diferencaCredito.negated(), 0).toFixed(2),
    };
  });
  if (itens.some(item => valor(item.reducaoCredito).gt(0))) {
    return { tipo: "PENDENCIA", motivo: "Redução de crédito exige ajuste financeiro auditável antes da efetivação.", itens };
  }
  if (fotoAnteriorHash === fotoAtualHash) {
    if (itens.some(item => item.ajusteDevido !== "0.00" || item.ajusteSaldo !== "0.00" || item.creditoDelta !== "0.00")) {
      throw new Error("Fotografia sem alteração contradiz os efeitos financeiros calculados.");
    }
    return { tipo: "SEM_EFEITO", itens };
  }
  return { tipo: "APLICAR", itens };
}
