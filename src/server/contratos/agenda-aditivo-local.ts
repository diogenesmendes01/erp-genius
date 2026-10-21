"use server";

import { executarAcao } from "@/server/_shared";
import { exigirInstanteDoCampoLocal } from "@/server/_shared/campo-local";
import { consultarConferenciaAgendaAditivo } from "./agenda-aditivo";

export type AlteracaoAgendaLocal = { encontroId: string; professorNovoId: string; fusoOrigem: string; inicioLocal: string; fimLocal: string };

/**
 * Conferência da agenda do aditivo com os horários DIGITADOS (lote 3 do fuso pessoal nas telas): cada encontro
 * traz o texto dos `datetime-local` e o fuso escolhido no <CampoFuso> ao lado; a conversão em instante é aqui, no
 * servidor (antes, o navegador convertia). Horário pulado ou repetido no horário de verão volta como erro legível.
 */
export async function consultarConferenciaAgendaAditivoLocal(input: { matriculaId: string; alteracoes: AlteracaoAgendaLocal[] }) {
  const r = await executarAcao(async () => ({
    matriculaId: input.matriculaId,
    encontros: input.alteracoes.map((a) => {
      const inicio = exigirInstanteDoCampoLocal(a.inicioLocal, a.fusoOrigem), fim = exigirInstanteDoCampoLocal(a.fimLocal, a.fusoOrigem);
      return { encontroId: a.encontroId, professorNovoId: a.professorNovoId, inicioNovo: inicio.toISOString(), fimNovo: fim.toISOString(), duracaoMinutos: Math.round((fim.getTime() - inicio.getTime()) / 60_000), fusoOrigem: a.fusoOrigem };
    }),
  }));
  if (!r.ok) return r;
  return consultarConferenciaAgendaAditivo(r.dado!);
}
