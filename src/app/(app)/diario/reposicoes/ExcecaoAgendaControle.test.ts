import { expect, it } from "vitest";
import { montarPropostaExcecaoAgenda } from "./ExcecaoAgendaControle";

it("monta o payload estrito da proposta sem campos auxiliares da prévia", () => {
  const horario = { professorId: "professor-1", professor: "Docente legível", inicioLocal: "2026-10-12T10:00", fimLocal: "2026-10-12T11:00", fuso: "America/Sao_Paulo", autorizacaoExcecaoId: undefined, reposicaoId: "nao-deve-vazar" };
  expect(montarPropostaExcecaoAgenda("reposicao-1", horario, "Motivo conferido", "Evidência conferida", "chave-1")).toEqual({ reposicaoId: "reposicao-1", professorId: "professor-1", inicioLocal: "2026-10-12T10:00", fimLocal: "2026-10-12T11:00", fuso: "America/Sao_Paulo", motivo: "Motivo conferido", evidencia: "Evidência conferida", chaveIdempotencia: "chave-1" });
});
