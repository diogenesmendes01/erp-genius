import { expect, it } from "vitest";
import { gerarGradeEncontros, instanteDaGrade } from "./grade";
const base = () => ({ dataInicial: "2026-09-07", diasSemana: [2, 4], horario: "19:00", duracaoMinutos: 90, quantidadeAulas: 3, fusoOrigem: "America/Sao_Paulo", fusoEscola: "America/Sao_Paulo", periodos: [] });
it("começa no próximo dia válido e gera a quantidade exata sem publicar", () => {
  const r = gerarGradeEncontros(base());
  expect(r.encontros.map((e) => e.dataOrigem)).toEqual(["2026-09-08", "2026-09-10", "2026-09-15"]);
  expect(r.primeiraAula).toBe("2026-09-08T22:00:00.000Z"); expect(r.previsaoTermino).toBe("2026-09-15T23:30:00.000Z"); expect(r.publicada).toBe(false);
});
it("pula feriado e recesso sem reduzir a quantidade", () => {
  const r = gerarGradeEncontros({ ...base(), periodos: [{ id: "f1", nome: "Feriado", tipo: "FERIADO", inicio: "2026-09-08", fim: "2026-09-10" }] });
  expect(r.encontros.map((e) => e.dataOrigem)).toEqual(["2026-09-15", "2026-09-17", "2026-09-22"]);
});
it("aula que alcança feriado após meia-noite é pulada integralmente", () => {
  const r = gerarGradeEncontros({ ...base(), horario: "23:00", duracaoMinutos: 120, quantidadeAulas: 1, periodos: [{ id: "f1", nome: "Feriado", tipo: "FERIADO", inicio: "2026-09-09", fim: "2026-09-09" }] });
  expect(r.encontros[0]).toEqual({ dataOrigem: "2026-09-10", inicio: "2026-09-11T02:00:00.000Z", fim: "2026-09-11T04:00:00.000Z" });
});
it("preserva horário local quando o offset muda entre encontros", () => {
  const r = gerarGradeEncontros({ ...base(), dataInicial: "2026-03-01", diasSemana: [0], horario: "09:00", quantidadeAulas: 2, fusoOrigem: "America/New_York" });
  expect(r.encontros.map((e) => e.inicio)).toEqual(["2026-03-01T14:00:00.000Z", "2026-03-08T13:00:00.000Z"]);
});
it("não escolhe silenciosamente horário inexistente ou ambíguo", () => {
  expect(() => instanteDaGrade("2026-03-08", "02:30", "America/New_York")).toThrow(/inexistente/);
  expect(() => instanteDaGrade("2026-11-01", "01:30", "America/New_York")).toThrow(/ambíguo/);
});
