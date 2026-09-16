import { expect, it, vi } from "vitest";
import { renderizarHorariosReplanejamento, validarFonteReplanejamentoConjuntoTx } from "./fonte-replanejamento";
it("renderiza início e término antigo/novo mesmo quando só o término muda", () => {
  const texto = renderizarHorariosReplanejamento([{ encontroId: "e1", inicioAnterior: "2099-10-01T19:00:00.000Z", fimAnterior: "2099-10-01T20:00:00.000Z", inicioProposto: "2099-10-01T19:00:00.000Z", fimProposto: "2099-10-01T20:30:00.000Z", fusoOrigem: "UTC" }]);
  expect(texto).toContain("20:00"); expect(texto).toContain("20:30"); expect(texto).toContain("UTC");
  expect(renderizarHorariosReplanejamento([])).toBeNull();
});
it("rejeita IDs ou horários duplicados antes de ler a fotografia", async () => {
  const horario = { encontroId: "a", inicioAnterior: "2099-01-01T10:00:00.000Z", fimAnterior: "2099-01-01T11:00:00.000Z", inicioProposto: "2099-01-02T10:00:00.000Z", fimProposto: "2099-01-02T11:00:00.000Z" };
  const rascunho = vi.fn();
  for (const [ids, horarios] of [[ ["a", "b"], [horario, horario] ], [["a", "a"], [horario, { ...horario, encontroId: "b" }]]]) {
    const tx = { evento: { findUnique: vi.fn().mockResolvedValue({ tipo: "ReplanejamentoConjuntoAplicado", agregadoTipo: "ConfiguracaoOperacional", agregadoId: "escola", payload: { aprovada: true, revisaoId: "r", decisaoId: "d", encontrosIds: ids, horarios } }) }, rascunhoReplanejamento: { findUnique: rascunho } };
    expect(await validarFonteReplanejamentoConjuntoTx(tx as never, { eventoId: "e", matriculaId: "m", encontrosIds: ["a"] })).toBeNull();
  }
  expect(rascunho).not.toHaveBeenCalled();
});
