import { expect, it } from "vitest";
import { renderizarHorariosReplanejamento } from "./fonte-replanejamento";
it("renderiza início e término antigo/novo mesmo quando só o término muda", () => {
  const texto = renderizarHorariosReplanejamento([{ encontroId: "e1", inicioAnterior: "2099-10-01T19:00:00.000Z", fimAnterior: "2099-10-01T20:00:00.000Z", inicioProposto: "2099-10-01T19:00:00.000Z", fimProposto: "2099-10-01T20:30:00.000Z", fusoOrigem: "UTC" }]);
  expect(texto).toContain("20:00"); expect(texto).toContain("20:30"); expect(texto).toContain("UTC");
  expect(renderizarHorariosReplanejamento([])).toBeNull();
});
