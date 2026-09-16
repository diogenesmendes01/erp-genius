import { expect, it } from "vitest";
import { hashAgendaRecuperacao } from "./recuperacao-agenda-estado";
it("mantém a conferência após reordenação das chaves pelo JSONB", () => {
  expect(hashAgendaRecuperacao({ professor: { id: "docente", nome: "Nome" }, conflitos: [] }))
    .toBe(hashAgendaRecuperacao({ conflitos: [], professor: { nome: "Nome", id: "docente" } }));
});
it("alteração do avaliador ou dos intervalos invalida a conferência", () => {
  const original = { professor: { id: "docente" }, conflitos: [{ inicio: "2026-10-01T12:00:00Z", fim: "2026-10-01T13:00:00Z" }] };
  expect(hashAgendaRecuperacao(original)).not.toBe(hashAgendaRecuperacao({ ...original, professor: { id: "substituto" } }));
  expect(hashAgendaRecuperacao(original)).not.toBe(hashAgendaRecuperacao({ ...original, conflitos: [] }));
});
