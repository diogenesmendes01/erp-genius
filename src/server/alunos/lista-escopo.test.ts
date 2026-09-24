import { Papel } from "@prisma/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  alunos: vi.fn(async () => [] as unknown[]),
  contar: vi.fn(async () => 0),
  paises: vi.fn(async () => [] as unknown[]),
  turmas: vi.fn(async () => [] as unknown[]),
}));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    aluno: { findMany: mocks.alunos, count: mocks.contar },
    pais: { findMany: mocks.paises },
    turma: { findMany: mocks.turmas },
  },
}));

import { escopoAlunos, listarAlunos, listarAlunosPagina, opcoesFiltroAlunos, whereListaAlunos } from "./consultas";
import { lerFiltrosAlunos } from "./filtros";
import { escopoTurmasDocente } from "@/server/diario/permissoes";

const professor = { id: "prof", nome: "Pr", papeis: [Papel.PROFESSOR] };
const secretaria = { id: "sec", nome: "Se", papeis: [Papel.SECRETARIA_ACADEMICA] };
const semPapel = { id: "x", nome: "X", papeis: [Papel.VENDEDOR] };
const comTurma = lerFiltrosAlunos({ turma: "t-alheia", status: "ATIVO" });

describe("lista de alunos: escopo sempre junto dos filtros", () => {
  // escopoTurmasDocente usa `new Date()` (vínculo docente vigente): relógio fixo para comparar as condições.
  beforeEach(() => {
    vi.useFakeTimers({ now: new Date("2026-09-24T12:00:00Z"), toFake: ["Date"] });
    mocks.alunos.mockClear(); mocks.contar.mockClear(); mocks.turmas.mockClear(); mocks.paises.mockClear();
  });
  afterEach(() => { vi.useRealTimers(); });

  it("professor: escopo das turmas dele E filtro de turma também preso às turmas dele", () => {
    const w = whereListaAlunos(professor, comTurma) as { AND: [unknown, { AND: unknown[] }] };
    expect(w.AND[0]).toEqual(escopoAlunos(professor));
    expect(w.AND[1].AND).toContainEqual({ alocacoes: { some: { ativa: true, turmaId: "t-alheia", turma: escopoTurmasDocente("prof") } } });
  });

  it("papel amplo: sem limite de turma no filtro (vê todas as turmas)", () => {
    const w = whereListaAlunos(secretaria, comTurma) as { AND: [unknown, { AND: unknown[] }] };
    expect(w.AND[0]).toEqual({});
    expect(w.AND[1].AND).toContainEqual({ alocacoes: { some: { ativa: true, turmaId: "t-alheia" } } });
  });

  it("sem papel de alunos: escopo impossível continua valendo com qualquer filtro", () => {
    const w = whereListaAlunos(semPapel, lerFiltrosAlunos({ busca: "a" })) as { AND: unknown[] };
    expect(w.AND[0]).toEqual({ id: { in: [] } });
  });

  it("a consulta, a contagem filtrada e a contagem base usam o escopo (o professor nunca vê todos)", async () => {
    await listarAlunosPagina(professor, comTurma);
    const escopo = escopoAlunos(professor);
    expect((mocks.alunos.mock.calls[0] as unknown[])[0]).toMatchObject({ where: { AND: [escopo, expect.anything()] }, skip: 0, take: 50 });
    expect(mocks.contar.mock.calls.map((c) => (c as unknown[])[0])).toEqual([
      { where: { AND: [escopo, expect.anything()] } },
      { where: escopo },
    ]);
  });

  it("exportação (listarAlunos com filtros, sem página): mesmo escopo, sem skip/take", async () => {
    await listarAlunos(professor, comTurma);
    const args = (mocks.alunos.mock.calls[0] as unknown[])[0] as Record<string, unknown>;
    expect(args.where).toEqual(whereListaAlunos(professor, comTurma));
    expect(args).not.toHaveProperty("take");
  });

  it("opções de turma: professor só as dele; papel amplo, as com alunos ativos", async () => {
    await opcoesFiltroAlunos(professor);
    expect((mocks.turmas.mock.calls[0] as unknown[])[0]).toMatchObject({ where: escopoTurmasDocente("prof") });
    await opcoesFiltroAlunos(secretaria);
    expect((mocks.turmas.mock.calls[1] as unknown[])[0]).toMatchObject({ where: { alocacoes: { some: { ativa: true } } } });
    expect((mocks.paises.mock.calls[0] as unknown[])[0]).toMatchObject({ where: { alunos: { some: escopoAlunos(professor) } } });
  });
});
