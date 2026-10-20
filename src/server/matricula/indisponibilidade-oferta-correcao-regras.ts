import { ErroRegra } from "@/server/_shared";

export type PeriodoRelato = { inicio: string; fim: string | null };
const FIM_ABERTO = "9999-12-31";

const diaSeguinte = (dia: string) => { const d = new Date(`${dia}T00:00:00.000Z`); d.setUTCDate(d.getUTCDate() + 1); return d.toISOString().slice(0, 10); };
const diaAnterior = (dia: string) => { const d = new Date(`${dia}T00:00:00.000Z`); d.setUTCDate(d.getUTCDate() - 1); return d.toISOString().slice(0, 10); };

/**
 * Q157: a correção trata o período informado no relato. Relato aberto continua encerrando
 * pelo término aprovado (Q156) e relato encerrado não é reaberto; `fimVigente` é o fim
 * efetivo (do relato ou do término aprovado), usado só para limitar o novo início.
 */
export function conferirCorrecaoPeriodoRelato(atual: PeriodoRelato, novo: PeriodoRelato, terminoAprovado: string | null) {
  if (novo.inicio === atual.inicio && novo.fim === atual.fim) throw new ErroRegra("A correção não altera o período do relato.");
  if (atual.fim === null && novo.fim !== null) throw new ErroRegra("Relato aberto encerra pelo término aprovado, não pela correção.");
  if (atual.fim !== null && novo.fim === null) throw new ErroRegra("A correção não reabre um relato encerrado.");
  if (novo.inicio > (novo.fim ?? terminoAprovado ?? FIM_ABERTO)) throw new ErroRegra("O início corrigido não pode ultrapassar o fim vigente do relato.");
}

/**
 * Intervalos civis que o relato deixa de cobrir; são eles que não podem já sustentar compensação.
 *
 * Decisão (C2 da #265): só os dias REMOVIDOS são conferidos. Os dias ACRESCENTADOS por uma correção que
 * amplia o período (início antes, fim depois) não são conferidos contra a disponibilidade positiva aprovada
 * (Q161) nem contra a cobertura futura de um período integral aprovado. É o mesmo tratamento do relato novo,
 * cujo INSERT também não confere isso, e a Q161 diz que a indisponibilidade confirmada prevalece. O guard
 * SQL (migration 20261020210000, já aplicada e por isso não editada) segue a mesma decisão.
 */
export function diasRemovidosPelaCorrecao(atual: PeriodoRelato, novo: PeriodoRelato, terminoAprovado: string | null): Array<{ inicio: string; fim: string }> {
  const fimAtual = atual.fim ?? terminoAprovado ?? FIM_ABERTO, fimNovo = novo.fim ?? terminoAprovado ?? FIM_ABERTO;
  const removidos: Array<{ inicio: string; fim: string }> = [];
  if (novo.inicio > atual.inicio) removidos.push({ inicio: atual.inicio, fim: diaAnterior(novo.inicio) < fimAtual ? diaAnterior(novo.inicio) : fimAtual });
  if (fimNovo < fimAtual) removidos.push({ inicio: diaSeguinte(fimNovo) > atual.inicio ? diaSeguinte(fimNovo) : atual.inicio, fim: fimAtual });
  return removidos;
}
