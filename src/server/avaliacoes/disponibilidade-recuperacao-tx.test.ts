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

it("usa início importado e o menor término ao procurar conflitos de turma", async () => {
  const historico = new Date("2025-01-01T00:00:00Z");
  const fimHistorico = new Date("2025-04-01T00:00:00Z");
  const fimOperacional = new Date("2025-03-01T00:00:00Z");
  const encontros = vi.fn().mockResolvedValue([]);
  const alocacoes = vi.fn().mockResolvedValue([{ turmaId: "historica", criadoEm: new Date("2026-09-16T00:00:00Z"), provenienciaVinculo: "MIGRACAO", inicioVigencia: historico, fimVigencia: fimHistorico, encerradaEm: fimOperacional }]);
  const tx = { alocacaoTurma: { findMany: alocacoes }, encontroAgenda: { findMany: encontros }, indisponibilidadeDocente: { count: vi.fn() }, horarioReservaParticular: { count: vi.fn().mockResolvedValue(0) } } as unknown as Prisma.TransactionClient;
  await disponibilidadeRecuperacaoTx(tx, { alunoId: "a", professorId: null, inicio: new Date("2025-02-28T23:30:00Z"), fim: new Date("2025-03-01T01:00:00Z") });
  expect(encontros.mock.calls[0][0].where.OR).toContainEqual({ turmaId: "historica", matriculaId: null, inicio: { lt: fimOperacional }, fim: { gt: historico } });
  expect(alocacoes.mock.calls[0][0].where.OR[0]).toMatchObject({ provenienciaVinculo: "MIGRACAO", inicioVigencia: { lt: new Date("2025-03-01T01:00:00Z") } });
});
