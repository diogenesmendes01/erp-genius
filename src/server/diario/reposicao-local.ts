"use server";

import { executarAcao } from "@/server/_shared";
import { exigirInstanteDoCampoLocal } from "@/server/_shared/campo-local";
import { concluirReposicaoIndividual, proporCorrecaoConclusaoReposicao } from "./reposicao-individual";
import { liberarEntregaOperacional, prorrogarEtapaOperacional } from "./reposicao-entrega-operacional";

type Local = { fuso: string };

export async function concluirReposicaoGravadaLocal(input: Omit<Parameters<typeof concluirReposicaoIndividual>[0], "validadaEm" | "realizadaEm" | "encontroReposicaoId"> & Local & { validadaLocal: string }) {
  const r = await executarAcao(async () => {
    const { validadaLocal, fuso, ...resto } = input;
    return { ...resto, validadaEm: exigirInstanteDoCampoLocal(validadaLocal, fuso).toISOString() };
  });
  if (!r.ok) return r;
  return concluirReposicaoIndividual(r.dado!);
}

export async function proporCorrecaoGravadaLocal(input: Omit<Parameters<typeof proporCorrecaoConclusaoReposicao>[0], "validadaEm"> & Local & { validadaLocal: string }) {
  const r = await executarAcao(async () => {
    const { validadaLocal, fuso, ...resto } = input;
    return { ...resto, validadaEm: exigirInstanteDoCampoLocal(validadaLocal, fuso).toISOString() };
  });
  if (!r.ok) return r;
  return proporCorrecaoConclusaoReposicao(r.dado!);
}

export async function prorrogarEtapaOperacionalLocal(input: { reposicaoId: string; solicitacaoCorrecaoId: string | null; prazoAnterior: string | null; novoPrazoLocal: string; fuso: string; motivo: string }) {
  const r = await executarAcao(async () => {
    const { novoPrazoLocal, fuso, ...resto } = input;
    return { ...resto, novoPrazo: exigirInstanteDoCampoLocal(novoPrazoLocal, fuso).toISOString() };
  });
  if (!r.ok) return r;
  return prorrogarEtapaOperacional(r.dado!);
}

export async function liberarEntregaOperacionalLocal(input: { reposicaoId: string; expiraLocal: string; fuso: string; motivo: string }) {
  const r = await executarAcao(async () => {
    const { expiraLocal, fuso, ...resto } = input;
    return { ...resto, expiraEm: exigirInstanteDoCampoLocal(expiraLocal, fuso).toISOString() };
  });
  if (!r.ok) return r;
  return liberarEntregaOperacional(r.dado!);
}
