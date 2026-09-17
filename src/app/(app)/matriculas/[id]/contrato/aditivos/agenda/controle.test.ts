import { expect, it, vi } from "vitest";
import { alternarEncontro, deveDesabilitarControles, limparResultadoAoEditar, montarAlteracoesAgenda, professorSelecionado } from "./controle";

const valores = { e1: { professorNovoId: "atual", fusoOrigem: "America/New_York", inicioLocal: "2026-03-09T10:00", fimLocal: "2026-03-09T11:00" } };

it("mantém o docente atual selecionado e limpa a seleção ao editar", () => {
  expect(professorSelecionado("atual", [{ id: "primeiro" }, { id: "atual" }])).toBe("atual");
  expect(professorSelecionado("inativo", [{ id: "primeiro" }])).toBe("");
  expect(alternarEncontro(["e1"], "e1")).toEqual([]);
  expect(limparResultadoAoEditar()).toBeNull();
});

it("recusa DST inválido antes de qualquer chamada e bloqueia controles enquanto consulta", () => {
  const servidor = vi.fn();
  expect(() => montarAlteracoesAgenda(["e1"], { e1: { ...valores.e1, inicioLocal: "2026-03-08T02:30" } })).toThrow(/inexistente/);
  expect(servidor).not.toHaveBeenCalled();
  expect(deveDesabilitarControles(true)).toBe(true);
  expect(deveDesabilitarControles(false)).toBe(false);
});
