"use server";
import { z } from "zod";
import { executarAcao, ErroRegra } from "@/server/_shared";
import { instanteAvaliacaoLocal } from "./tempo";
import { registrarDisponibilizacaoRecuperacao } from "./recuperacao-disponibilizacao";
import { registrarRealizacaoRecuperacao } from "./recuperacao-realizacao";
import { proporProrrogacaoRecuperacao } from "./recuperacao-prorrogacao";

const horario = z.object({ dataHora: z.string(), fuso: z.string() });
export async function proporProrrogacaoRecuperacaoLocal(input: { disponibilizacaoId: string; prazoAnterior: string; dataHora: string; fuso: string; versaoEsperada: number; motivo: string; chaveIdempotencia: string }) {
  return executarAcao(async () => {
    const { dataHora, fuso } = horario.parse(input);
    const r = await proporProrrogacaoRecuperacao({ disponibilizacaoId: input.disponibilizacaoId, prazoAnterior: input.prazoAnterior, novoPrazo: instanteAvaliacaoLocal(dataHora, fuso).toISOString(), versaoEsperada: input.versaoEsperada, motivo: input.motivo, chaveIdempotencia: input.chaveIdempotencia });
    if (!r.ok) throw new ErroRegra(r.erro);
    return r.dado;
  });
}
export async function disponibilizarRecuperacaoLocal(input: { propostaId: string; propostaHash: string; dataHora: string; fuso: string; condicoes: string; evidenciaComunicacao: string; autorizacaoPreparacaoId?: string }) {
  return executarAcao(async () => {
    const { dataHora, fuso } = horario.parse(input);
    const r = await registrarDisponibilizacaoRecuperacao({ propostaId: input.propostaId, propostaHash: input.propostaHash, disponibilizadaEm: instanteAvaliacaoLocal(dataHora, fuso).toISOString(), condicoes: input.condicoes, evidenciaComunicacao: input.evidenciaComunicacao, autorizacaoPreparacaoId: input.autorizacaoPreparacaoId });
    if (!r.ok) throw new ErroRegra(r.erro);
    return r.dado;
  });
}
export async function realizarRecuperacaoLocal(input: { itemReservaId: string; dataHora: string; fuso: string; evidencia: string; realizadaPorId?: string; motivoRegularizacao?: string }) {
  return executarAcao(async () => {
    const { dataHora, fuso } = horario.parse(input);
    const r = await registrarRealizacaoRecuperacao({ itemReservaId: input.itemReservaId, realizadaPorId: input.realizadaPorId, motivoRegularizacao: input.motivoRegularizacao, realizadaEm: instanteAvaliacaoLocal(dataHora, fuso).toISOString(), evidencia: input.evidencia });
    if (!r.ok) throw new ErroRegra(r.erro);
    return r.dado;
  });
}
