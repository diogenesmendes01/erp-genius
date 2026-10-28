import { expect, it } from "vitest";
import { podeAgirNaTarefa } from "./historico";

const vendedor = { id: "u481", nome: "Vendedora", papeis: ["VENDEDOR" as const] };
const gerente = { id: "g481", nome: "Gerente", papeis: ["GERENTE_COMERCIAL" as const] };

it("só responsável, criador ou quem vê a equipe conclui e reabre", () => {
  const alheia = { status: "ABERTA" as const, responsavelId: "outro", criadorId: "outro" };
  const propria = { status: "CONCLUIDA" as const, responsavelId: "u481", criadorId: "outro" };
  const criada = { status: "CONCLUIDA" as const, responsavelId: "outro", criadorId: "u481" };
  const cancelada = { status: "CANCELADA" as const, responsavelId: "u481", criadorId: "u481" };
  expect(podeAgirNaTarefa(vendedor, alheia)).toBe(false);
  expect(podeAgirNaTarefa(vendedor, propria)).toBe(true);
  expect(podeAgirNaTarefa(vendedor, criada)).toBe(true);
  expect(podeAgirNaTarefa(vendedor, cancelada)).toBe(false);
  expect(podeAgirNaTarefa(gerente, alheia)).toBe(true);
  expect(podeAgirNaTarefa(gerente, { ...alheia, status: "CONCLUIDA" })).toBe(true);
});
