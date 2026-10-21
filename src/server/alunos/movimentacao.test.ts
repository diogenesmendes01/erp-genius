import { beforeEach, describe, expect, it, vi } from "vitest";
import { Papel } from "@prisma/client";

const m = vi.hoisted(() => ({
  papel: "SECRETARIA_ACADEMICA" as string,
  $queryRaw: vi.fn(),
  usuario: { findUnique: vi.fn() },
  aluno: { findUnique: vi.fn(), update: vi.fn() },
  turma: { findUnique: vi.fn(), findMany: vi.fn() },
  alocacaoTurma: { findMany: vi.fn(), update: vi.fn(), updateMany: vi.fn(), create: vi.fn() },
  matricula: { findMany: vi.fn(), count: vi.fn() }, cobranca: { updateMany: vi.fn() }, movimentacaoAluno: { create: vi.fn(), findFirst: vi.fn(), count: vi.fn() },
  solicitacaoMudancaAcademica: { findFirst: vi.fn() },
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ prisma: { ...m, $transaction: async (f: (tx: typeof m) => Promise<unknown>) => f(m) } }));
vi.mock("@/server/_shared", async (original) => {
  const real = await original<typeof import("@/server/_shared")>();
  return { ...real, registrarEvento: vi.fn(), exigirSessaoComPapel: async (...papeis: Papel[]) => {
    const u = { id: "operador", nome: "Operador", papeis: [m.papel as Papel] };
    real.exigirPapel(u, ...papeis); return u;
  } };
});
import { trocarTurma, encerrarAluno, editarAluno } from "./acoes";

beforeEach(() => {
  vi.clearAllMocks(); m.papel = Papel.SECRETARIA_ACADEMICA;
  m.usuario.findUnique.mockImplementation(async () => ({ id: "operador", nome: "Operador", ativo: true, papeis: [m.papel] }));
  m.aluno.findUnique.mockResolvedValue({ id: "aluno", status: "ATIVO", alocacoes: [{ id: "alocacao", turmaId: "origem", criadoEm: new Date(2026, 0, 1), turma: { id: "origem", nivelId: "a1", modalidadeId: "regular", online: true, nivel: { idiomaId: "ingles" } } }] });
  m.turma.findUnique.mockResolvedValue({ id: "destino", nivelId: "a1", modalidadeId: "regular", online: true, nivel: { idiomaId: "ingles" }, status: "EM_ANDAMENTO", capacidade: 10, _count: { alocacoes: 2 }, dataFim: null });
  m.turma.findMany.mockResolvedValue([{ nivelId: "a1", modalidadeId: "regular" }]);
  m.alocacaoTurma.findMany.mockResolvedValue([{ turmaId: "origem" }]);
  m.matricula.findMany.mockResolvedValue([]);
  m.matricula.count.mockResolvedValue(0);
  m.movimentacaoAluno.findFirst.mockResolvedValue(null);
  m.movimentacaoAluno.count.mockResolvedValue(0);
  m.solicitacaoMudancaAcademica.findFirst.mockResolvedValue(null);
});

describe("transferência respeita autoridade e estado acadêmico", () => {
  it("secretaria deve usar equivalência aprovada mesmo dentro do mesmo nível e idioma", async () => {
    expect(await trocarTurma("aluno", { turmaDestinoId: "destino", horarioCompativel: true })).toMatchObject({
      ok: false, erro: expect.stringContaining("aprovação pedagógica independente"),
    });
    expect(m.alocacaoTurma.update).not.toHaveBeenCalled();
    expect(m.alocacaoTurma.create).not.toHaveBeenCalled();
  });
  it("secretaria não decide avanço de A1 para B2, mesmo com justificativa", async () => {
    m.turma.findUnique.mockResolvedValue({ id: "destino", nivelId: "b2", modalidadeId: "regular", online: true, nivel: { idiomaId: "ingles" }, status: "EM_ANDAMENTO", capacidade: 10, _count: { alocacoes: 2 } });
    expect((await trocarTurma("aluno", { turmaDestinoId: "destino", justificativa: "Solicitado", horarioCompativel: true })).ok).toBe(false);
    expect(m.alocacaoTurma.create).not.toHaveBeenCalled();
    expect(m.alocacaoTurma.update).not.toHaveBeenCalled();
  });
  it.each([Papel.GERENTE_PEDAGOGICO, Papel.ADMINISTRADOR])("%s não aplica exceção direta mesmo com justificativa", async (papel) => {
    m.papel = papel;
    m.turma.findUnique.mockResolvedValue({ id: "destino", nivelId: "b2", modalidadeId: "regular", online: true, nivel: { idiomaId: "ingles" }, status: "EM_ANDAMENTO", capacidade: 10, _count: { alocacoes: 2 } });
    expect((await trocarTurma("aluno", { turmaDestinoId: "destino", horarioCompativel: true })).ok).toBe(false);
    expect(m.alocacaoTurma.create).not.toHaveBeenCalled();
    expect((await trocarTurma("aluno", { turmaDestinoId: "destino", justificativa: "Avaliação de nivelamento aprovada", horarioCompativel: true })).ok).toBe(false);
    expect(m.alocacaoTurma.create).not.toHaveBeenCalled();
    expect(m.alocacaoTurma.update).not.toHaveBeenCalled();
  });
  it("rota direta não contorna aprovação nem para destino informado como concluído", async () => {
    m.turma.findUnique.mockResolvedValue({ id: "destino", nivelId: "a1", modalidadeId: "regular", online: true, nivel: { idiomaId: "ingles" }, status: "CONCLUIDA", capacidade: 10, _count: { alocacoes: 2 } });
    expect(await trocarTurma("aluno", { turmaDestinoId: "destino", horarioCompativel: true })).toMatchObject({ ok: false, erro: expect.stringContaining("fluxo de equivalência acadêmica") });
    expect(m.alocacaoTurma.create).not.toHaveBeenCalled();
  });
  it("equivalência não dispensa confirmação de horário", async () => {
    expect((await trocarTurma("aluno", { turmaDestinoId: "destino", horarioCompativel: false as unknown as true })).ok).toBe(false);
    expect(m.alocacaoTurma.create).not.toHaveBeenCalled();
    expect(m.aluno.findUnique).not.toHaveBeenCalled();
  });
  it("pedido acadêmico aberto impede outra transferência direta", async () => {
    m.solicitacaoMudancaAcademica.findFirst.mockResolvedValue({ id: "pedido-aberto" });
    expect((await trocarTurma("aluno", { turmaDestinoId: "destino", horarioCompativel: true })).ok).toBe(false);
    expect(m.alocacaoTurma.create).not.toHaveBeenCalled();
    expect(m.alocacaoTurma.update).not.toHaveBeenCalled();
  });
  it("encerramento libera vaga sem apagar histórico da alocação", async () => {
    expect((await encerrarAluno("aluno", { motivo: "Concluiu" })).ok).toBe(true);
    expect(m.alocacaoTurma.updateMany).toHaveBeenCalledWith({ where: { alunoId: "aluno", ativa: true }, data: { ativa: false, encerradaEm: expect.any(Date) } });
  });
  it("encerramento global não alcança contratos com movimentação própria", async () => {
    m.matricula.count.mockResolvedValue(1);
    expect(await encerrarAluno("aluno", { motivo: "Concluiu" })).toMatchObject({ ok: false, erro: expect.stringContaining("fluxo contratual") });
    expect(m.aluno.update).not.toHaveBeenCalled();
    expect(m.alocacaoTurma.updateMany).not.toHaveBeenCalled();
    expect(m.cobranca.updateMany).not.toHaveBeenCalled();
  });
  it("papel pedagógico não edita documento administrativo", async () => {
    m.papel = Papel.GERENTE_PEDAGOGICO;
    expect((await editarAluno("aluno", { primeiroNome: "Ana", sobrenome: "Silva", paisId: "p1", documento: "123", motivo: "Correção" })).ok).toBe(false);
    expect(m.aluno.update).not.toHaveBeenCalled();
    expect(m.aluno.findUnique).not.toHaveBeenCalled();
  });
});
