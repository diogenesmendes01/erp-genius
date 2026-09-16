import { expect, it } from "vitest";
import { renderizarHorariosReplanejamento } from "./fonte-replanejamento";
it("renderiza apenas os horários já validados com o fuso da matrícula", () => {
  expect(renderizarHorariosReplanejamento([{ encontroId: "e1", inicioAnterior: "2099-10-01T19:00:00.000Z", fimAnterior: "2099-10-01T20:00:00.000Z", inicioProposto: "2099-10-08T19:00:00.000Z", fimProposto: "2099-10-08T20:00:00.000Z", fusoOrigem: "UTC" }])).toContain("UTC");
  expect(renderizarHorariosReplanejamento([])).toBeNull();
});
