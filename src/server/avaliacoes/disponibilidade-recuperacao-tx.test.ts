import { expect, it, vi } from "vitest";
import type { Prisma } from "@prisma/client";
import { disponibilidadeRecuperacaoTx } from "./disponibilidade-recuperacao-tx";

it("considera a turma histórica apenas para encontros coletivos", async () => {
  const findManyAlocacoes = vi.fn().mockResolvedValue([
    { turmaId: "turma-1", criadoEm: new Date("2026-09-01T00:00:00.000Z"), encerradaEm: null },
  ]);
  const findManyEncontros = vi.fn().mockResolvedValue([]);
  const tx = {
    alocacaoTurma: { findMany: findManyAlocacoes },
    encontroAgenda: { findMany: findManyEncontros },
    indisponibilidadeDocente: { count: vi.fn().mockResolvedValue(0) },
    horarioReservaParticular: { count: vi.fn().mockResolvedValue(0) },
  } as unknown as Prisma.TransactionClient;

  await disponibilidadeRecuperacaoTx(tx, {
    alunoId: "aluno-1",
    professorId: "professor-1",
    inicio: new Date("2026-09-10T10:00:00.000Z"),
    fim: new Date("2026-09-10T11:00:00.000Z"),
  });

  const where = findManyEncontros.mock.calls[0]![0].where;
  expect(where.OR).toContainEqual(expect.objectContaining({
    turmaId: "turma-1",
    matriculaId: null,
  }));
  expect(where.OR).toContainEqual({ matricula: { alunoId: "aluno-1" } });
  expect(where.OR).toContainEqual({ professorId: "professor-1" });
});
