export type HorarioExcecaoConferido = {
  professorId: string; professor: string; inicioLocal: string; fimLocal: string; fuso: string;
};

type DadosProposta = { reposicaoId: string; professorId: string; inicioLocal: string; fimLocal: string; fuso: string; motivo: string; evidencia: string; chaveIdempotencia: string };

/** Mantém o contrato estrito da action separado da prévia, que pode ter campos auxiliares. */
export function montarPropostaExcecaoAgenda(reposicaoId: string, horario: HorarioExcecaoConferido, motivo: string, evidencia: string, chaveIdempotencia: string): DadosProposta {
  return { reposicaoId, professorId: horario.professorId, inicioLocal: horario.inicioLocal, fimLocal: horario.fimLocal, fuso: horario.fuso, motivo, evidencia, chaveIdempotencia };
}
