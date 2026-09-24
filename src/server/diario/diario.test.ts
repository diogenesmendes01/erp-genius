import { beforeEach, describe, expect, it, vi } from "vitest";
import { Papel } from "@prisma/client";
const db = vi.hoisted(() => ({
  $queryRaw: vi.fn(), $executeRaw: vi.fn(), usuario: { findUnique: vi.fn() },
  matricula: { findMany: vi.fn() }, alocacaoTurma: { findMany: vi.fn() },
  encontroAgenda: { count: vi.fn() },
  papel: "PROFESSOR", turma: { findMany: vi.fn(), findUnique: vi.fn() },
  aulaDiario: { findMany: vi.fn(), findUnique: vi.fn(), findFirst: vi.fn(), create: vi.fn(), update: vi.fn() }, registroAulaAluno: { upsert: vi.fn() },
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ prisma: { ...db, $transaction: async (f: (tx: typeof db) => Promise<unknown>) => f(db) } }));
vi.mock("@/server/_shared", async (original) => {
  const real = await original<typeof import("@/server/_shared")>();
  return { ...real, registrarEvento: vi.fn(), exigirSessaoComPapel: async (...papeis: Papel[]) => {
    const u = { id: "prof", nome: "Professor", papeis: [db.papel as Papel] }; real.exigirPapel(u, ...papeis); return u;
  } };
});
import { listarAulasDiario } from "./consultas";
import { salvarAulaDiario } from "./acoes";
const u = (...papeis: Papel[]) => ({ id: "prof", nome: "Professor", papeis });
const instante = new Date("2026-01-15T19:00:00Z");
const entrada = () => ({ turmaId: "t1", ocorridaEm: instante.toISOString(), conteudo: "Conversação sobre viagens", registros: [{ alunoId: "a1", presente: true, observacao: "Boa participação" }] });
function turma() {
  return {
    id: "t1", codigo: "T-1", professorId: "prof", status: "EM_ANDAMENTO",
    vinculosDocentes: [{ professorId: "prof", inicio: new Date("2026-01-01"), fim: null as Date | null }],
    alocacoes: [{ alunoId: "a1", matriculaId: null, ativa: true, encerradaEm: null, criadoEm: new Date("2026-01-01"), aluno: { primeiroNome: "Ana", sobrenome: "Silva", documento: "CPF_PRIVADO", telefoneE164: "TELEFONE_PRIVADO" } }],
  };
}
function aula() {
  return { id: "aula", encontroId: null, encontro: null, turmaId: "t1", professorId: "prof", ocorridaEm: instante, conteudo: "Conversação", atualizadoEm: new Date(), professor: { nome: "Professor" }, turma: turma(), registros: [{ alunoId: "a1", nomeAluno: "Ana na época da aula", presente: true, observacao: "Boa participação", aluno: { nome: "Nome atual privado", telefone: "TELEFONE_PRIVADO" } }] };
}
beforeEach(() => {
  vi.clearAllMocks(); db.papel = Papel.PROFESSOR; db.turma.findUnique.mockResolvedValue(turma()); db.aulaDiario.findUnique.mockResolvedValue(aula());
  db.$queryRaw.mockResolvedValue([]); db.usuario.findUnique.mockResolvedValue({ ativo: true, papeis: [Papel.PROFESSOR] });
  db.matricula.findMany.mockResolvedValue([]); db.alocacaoTurma.findMany.mockResolvedValue([]);
  db.encontroAgenda.count.mockResolvedValue(0);
  db.aulaDiario.findMany.mockResolvedValue([aula()]); db.aulaDiario.create.mockResolvedValue({ id: "nova-aula" });
});

describe("diário mantém história de autoria sem reabrir cadastro", () => {
  it("ex-professor da turma lê só seus snapshots e não edita", async () => {
    const registro = aula(); registro.turma.professorId = "novo-professor"; db.aulaDiario.findMany.mockResolvedValue([registro]);
    const res = await listarAulasDiario(u(Papel.PROFESSOR));
    expect(db.aulaDiario.findMany.mock.calls[0][0].where).toEqual({ professorId: "prof" });
    expect(res.aulas[0].podeEditar).toBe(false);
    expect(res.aulas[0].registros[0].nomeAluno).toBe("Ana na época da aula");
    expect(JSON.stringify(res)).not.toMatch(/PRIVADO|Nome atual privado|documento|telefone/);
  });
  it("saída de aluno congela apenas seu registro pessoal", async () => {
    const registro = aula(); registro.turma.alocacoes = []; db.aulaDiario.findMany.mockResolvedValue([registro]);
    const res = await listarAulasDiario(u(Papel.PROFESSOR));
    expect(res.aulas[0].podeEditar).toBe(true);
    expect(res.aulas[0].registros[0].podeEditar).toBe(false);
  });
  it("retorno do aluno não reabre presença anterior à nova alocação", async () => {
    const registro = aula(); registro.turma.alocacoes[0].criadoEm = new Date("2026-02-01");
    db.aulaDiario.findMany.mockResolvedValue([registro]);
    const res = await listarAulasDiario(u(Papel.PROFESSOR));
    expect(res.aulas[0].podeEditar).toBe(true);
    expect(res.aulas[0].registros[0].podeEditar).toBe(false);
  });
  it("retorno do professor não reabre aulas do vínculo encerrado", async () => {
    const registro = aula();
    registro.turma.vinculosDocentes = [
      { professorId: "prof", inicio: new Date("2026-01-01"), fim: new Date("2026-02-01") },
      { professorId: "prof", inicio: new Date("2026-03-01"), fim: null },
    ];
    db.aulaDiario.findMany.mockResolvedValue([registro]);
    db.turma.findUnique.mockResolvedValue(registro.turma);
    expect((await listarAulasDiario(u(Papel.PROFESSOR))).aulas[0].podeEditar).toBe(false);
    expect((await salvarAulaDiario({ ...entrada(), aulaId: "aula" })).ok).toBe(false);
    expect(db.aulaDiario.update).not.toHaveBeenCalled();
  });
  it("papel de vendedor não mantém leitura por autoria histórica", async () => {
    expect((await listarAulasDiario(u(Papel.VENDEDOR))).aulas).toEqual([]);
    expect(db.aulaDiario.findMany).not.toHaveBeenCalled();
  });
  it("busca (E4) entra em AND com o escopo, inclusive na validação do cursor", async () => {
    await listarAulasDiario(u(Papel.PROFESSOR), undefined, "verbos");
    const where = db.aulaDiario.findMany.mock.calls[0][0].where;
    expect(where.AND[0]).toEqual({ professorId: "prof" });
    expect(JSON.stringify(where.AND[1])).toContain("verbos");
    db.aulaDiario.findFirst.mockResolvedValueOnce(null); // cursor fora da busca
    expect((await listarAulasDiario(u(Papel.PROFESSOR), "aula-x", "verbos")).aulas).toEqual([]);
    expect(db.aulaDiario.findFirst.mock.calls.at(-1)![0].where).toEqual({ AND: [where, { id: "aula-x" }] });
  });
  it("gestão pedagógica consulta sem assumir autoria docente", async () => {
    const res = await listarAulasDiario(u(Papel.GERENTE_PEDAGOGICO));
    expect(db.aulaDiario.findMany.mock.calls[0][0].where).toEqual({}); expect(res.aulas[0].podeEditar).toBe(false);
  });
  it("projeta o instante histórico no fuso pessoal sem mudar a origem registrada", async () => {
    const registro = aula();
    registro.encontro = { professorId: "prof", status: "MINISTRADO", fim: instante, finalidade: "AULA", matriculaId: null, fusoOrigem: "UTC", publicacaoGravacao: null, excecoesGravacao: [] } as never;
    db.aulaDiario.findMany.mockResolvedValue([registro]);
    db.usuario.findUnique.mockResolvedValue({ ativo: true, fusoExibicao: "America/Costa_Rica" });
    expect((await listarAulasDiario(u(Papel.PROFESSOR))).aulas[0]).toMatchObject({ ocorridaEm: instante.toISOString(), fusoExibicao: "America/Costa_Rica" });
  });
  it("docente atual registra nome obtido no servidor e presença", async () => {
    expect((await salvarAulaDiario(entrada())).ok).toBe(true);
    expect(db.registroAulaAluno.upsert.mock.calls[0][0].create).toMatchObject({ nomeAluno: "Ana Silva", presente: true });
    expect(JSON.stringify(db.registroAulaAluno.upsert.mock.calls)).not.toContain("PRIVADO");
  });
  it("perda da turma bloqueia edição direta pelo ID", async () => {
    db.turma.findUnique.mockResolvedValue({ ...turma(), professorId: "novo" });
    expect((await salvarAulaDiario({ ...entrada(), aulaId: "aula" })).ok).toBe(false);
    expect(db.aulaDiario.update).not.toHaveBeenCalled(); expect(db.registroAulaAluno.upsert).not.toHaveBeenCalled();
  });
  it("papel docente revogado após a autenticação bloqueia gravação", async () => {
    db.usuario.findUnique.mockResolvedValue({ ativo: true, papeis: [Papel.VENDEDOR] });
    expect((await salvarAulaDiario(entrada())).ok).toBe(false);
    expect(db.aulaDiario.create).not.toHaveBeenCalled(); expect(db.registroAulaAluno.upsert).not.toHaveBeenCalled();
  });
  it("professor desativado após a autenticação não grava em sua antiga turma", async () => {
    db.usuario.findUnique.mockResolvedValue({ ativo: false, papeis: [Papel.PROFESSOR] });
    expect((await salvarAulaDiario({ ...entrada(), aulaId: "aula" })).ok).toBe(false);
    expect(db.aulaDiario.update).not.toHaveBeenCalled(); expect(db.registroAulaAluno.upsert).not.toHaveBeenCalled();
  });
  it("docente não altera presença histórica de aluno transferido", async () => {
    db.turma.findUnique.mockResolvedValue({ ...turma(), alocacoes: [] });
    const input = entrada(); input.registros[0].presente = false;
    expect((await salvarAulaDiario({ ...input, aulaId: "aula" })).ok).toBe(false);
    expect(db.registroAulaAluno.upsert).not.toHaveBeenCalled();
  });
  it("não fabrica aula anterior ao início conhecido do vínculo", async () => {
    expect((await salvarAulaDiario({ ...entrada(), ocorridaEm: "2025-01-01T19:00:00Z" })).ok).toBe(false);
    expect(db.aulaDiario.create).not.toHaveBeenCalled();
  });
});
