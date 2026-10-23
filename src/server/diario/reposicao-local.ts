"use server";

import { executarAcao } from "@/server/_shared";
import { exigirInstanteDoCampoLocal } from "@/server/_shared/campo-local";
import { concluirReposicaoIndividual, proporCorrecaoConclusaoReposicao } from "./reposicao-individual";
import { liberarEntregaOperacional, prorrogarEtapaOperacional } from "./reposicao-entrega-operacional";

// Entradas de data e hora das reposições (lote 3 do fuso pessoal nas telas): a tela manda o texto do
// `datetime-local` e o fuso que escreveu ao lado do campo; a conversão em instante é AQUI, explícita (antes, o
// navegador fazia `new Date(valor)` no fuso do dispositivo, ou a correção lia o valor como UTC). As ações de origem
// continuam recebendo o instante ISO e fazem as mesmas conferências.

type Local = { fuso: string };

/** Validação da reposição por gravação: `validadaLocal` no `fuso` da tela. */
export async function concluirReposicaoGravadaLocal(input: Omit<Parameters<typeof concluirReposicaoIndividual>[0], "validadaEm" | "realizadaEm" | "encontroReposicaoId"> & Local & { validadaLocal: string }) {
  const r = await executarAcao(async () => {
    const { validadaLocal, fuso, ...resto } = input;
    return { ...resto, validadaEm: exigirInstanteDoCampoLocal(validadaLocal, fuso).toISOString() };
  });
  if (!r.ok) return r;
  return concluirReposicaoIndividual(r.dado!);
}

/** Correção da conclusão por gravação: `validadaLocal` no `fuso` da tela (antes, lido como UTC no navegador). */
export async function proporCorrecaoGravadaLocal(input: Omit<Parameters<typeof proporCorrecaoConclusaoReposicao>[0], "validadaEm"> & Local & { validadaLocal: string }) {
  const r = await executarAcao(async () => {
    const { validadaLocal, fuso, ...resto } = input;
    return { ...resto, validadaEm: exigirInstanteDoCampoLocal(validadaLocal, fuso).toISOString() };
  });
  if (!r.ok) return r;
  return proporCorrecaoConclusaoReposicao(r.dado!);
}

/** Prorrogação da etapa de entrega: `novoPrazoLocal` no `fuso` da tela. */
export async function prorrogarEtapaOperacionalLocal(input: { reposicaoId: string; solicitacaoCorrecaoId: string | null; prazoAnterior: string | null; novoPrazoLocal: string; fuso: string; motivo: string }) {
  const r = await executarAcao(async () => {
    const { novoPrazoLocal, fuso, ...resto } = input;
    return { ...resto, novoPrazo: exigirInstanteDoCampoLocal(novoPrazoLocal, fuso).toISOString() };
  });
  if (!r.ok) return r;
  return prorrogarEtapaOperacional(r.dado!);
}

/** Liberação específica da entrega: `expiraLocal` no `fuso` da tela. */
export async function liberarEntregaOperacionalLocal(input: { reposicaoId: string; expiraLocal: string; fuso: string; motivo: string }) {
  const r = await executarAcao(async () => {
    const { expiraLocal, fuso, ...resto } = input;
    return { ...resto, expiraEm: exigirInstanteDoCampoLocal(expiraLocal, fuso).toISOString() };
  });
  if (!r.ok) return r;
  return liberarEntregaOperacional(r.dado!);
}
