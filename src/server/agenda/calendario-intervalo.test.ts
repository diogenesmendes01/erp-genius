import { expect, it } from "vitest";
import { conferirDiasNaoLetivos } from "./calendario-intervalo";
const base = () => ({ inicio: "2026-09-01T23:00:00-03:00", fim: "2026-09-02T01:00:00-03:00", fusoEscola: "America/Sao_Paulo", periodos: [{ id: "feriado", inicio: "2026-09-02", fim: "2026-09-02" }] });
it("confere o dia seguinte de aula que cruza meia-noite", () => {
  expect(conferirDiasNaoLetivos(base())).toEqual({ primeiroDia: "2026-09-01", ultimoDia: "2026-09-02", periodosAfetados: ["feriado"] });
});
it("fim exatamente à meia-noite não ocupa o feriado seguinte", () => {
  expect(conferirDiasNaoLetivos({ ...base(), fim: "2026-09-02T00:00:00-03:00" }).periodosAfetados).toEqual([]);
});
it("usa o fuso institucional, não a data textual do encontro", () => {
  expect(conferirDiasNaoLetivos({ ...base(), fusoEscola: "America/Costa_Rica" })).toMatchObject({ primeiroDia: "2026-09-01", ultimoDia: "2026-09-01", periodosAfetados: [] });
});
it("recusa período invertido e datas civis inexistentes", () => {
  expect(() => conferirDiasNaoLetivos({ ...base(), periodos: [{ id: "x", inicio: "2026-09-03", fim: "2026-09-02" }] })).toThrow();
  expect(() => conferirDiasNaoLetivos({ ...base(), periodos: [{ id: "x", inicio: "2026-02-30", fim: "2026-03-01" }] })).toThrow();
});
