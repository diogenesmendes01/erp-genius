import { describe, it, expect } from "vitest";
import { Papel } from "@prisma/client";
import {
  escopoAlunos,
  podeVerFinanceiroAluno,
  podeMovimentarAluno,
  vagasTurma,
} from "./consultas";
import type { UsuarioSessao } from "@/server/_shared";

const u = (id: string, ...papeis: Papel[]): UsuarioSessao => ({ id, nome: "T", papeis });

describe("escopoAlunos (visibilidade row-level, doc 07)", () => {
  it("sem usuário → sem restrição (compat. com chamadas internas)", () => {
    expect(escopoAlunos()).toEqual({});
  });

  it("Admin / Secretaria / Pedagógico / Financeiro veem todos os alunos", () => {
    expect(escopoAlunos(u("x", Papel.ADMINISTRADOR))).toEqual({});
    expect(escopoAlunos(u("x", Papel.SECRETARIA_ACADEMICA))).toEqual({});
    expect(escopoAlunos(u("x", Papel.GERENTE_PEDAGOGICO))).toEqual({});
    expect(escopoAlunos(u("x", Papel.FINANCEIRO))).toEqual({});
  });

  it("Professor só vê alunos alocados nas turmas dele", () => {
    expect(escopoAlunos(u("prof-1", Papel.PROFESSOR))).toEqual({
      alocacoes: { some: { ativa: true, turma: { professorId: "prof-1" } } },
    });
  });

  it("Professor que também é Secretaria vê todos (papel amplo prevalece)", () => {
    expect(escopoAlunos(u("x", Papel.PROFESSOR, Papel.SECRETARIA_ACADEMICA))).toEqual({});
  });
});

describe("podeVerFinanceiroAluno (projeção pedagógica, doc 10)", () => {
  it("sem usuário → permite (chamadas internas)", () => {
    expect(podeVerFinanceiroAluno()).toBe(true);
  });

  it("Professor 'puro' NÃO vê financeiro do aluno", () => {
    expect(podeVerFinanceiroAluno(u("prof-1", Papel.PROFESSOR))).toBe(false);
  });

  it("Papéis amplos veem financeiro (Admin/Secretaria/Pedagógico/Financeiro)", () => {
    expect(podeVerFinanceiroAluno(u("x", Papel.ADMINISTRADOR))).toBe(true);
    expect(podeVerFinanceiroAluno(u("x", Papel.SECRETARIA_ACADEMICA))).toBe(true);
    expect(podeVerFinanceiroAluno(u("x", Papel.GERENTE_PEDAGOGICO))).toBe(true);
    expect(podeVerFinanceiroAluno(u("x", Papel.FINANCEIRO))).toBe(true);
  });

  it("Professor que também é papel amplo vê financeiro (amplo prevalece)", () => {
    expect(podeVerFinanceiroAluno(u("x", Papel.PROFESSOR, Papel.FINANCEIRO))).toBe(true);
  });
});

describe("podeMovimentarAluno (visão somente leitura do professor, doc 10)", () => {
  it("sem usuário → permite (chamadas internas)", () => {
    expect(podeMovimentarAluno()).toBe(true);
  });

  it("Professor 'puro' NÃO movimenta (somente leitura)", () => {
    expect(podeMovimentarAluno(u("prof-1", Papel.PROFESSOR))).toBe(false);
  });

  it("Financeiro vê aluno mas NÃO faz movimentação acadêmica (doc 10)", () => {
    expect(podeMovimentarAluno(u("x", Papel.FINANCEIRO))).toBe(false);
  });

  it("Secretaria, Pedagógico e Admin movimentam", () => {
    expect(podeMovimentarAluno(u("x", Papel.SECRETARIA_ACADEMICA))).toBe(true);
    expect(podeMovimentarAluno(u("x", Papel.GERENTE_PEDAGOGICO))).toBe(true);
    expect(podeMovimentarAluno(u("x", Papel.ADMINISTRADOR))).toBe(true);
  });
});

/**
 * Capacidade/vagas devem considerar SOMENTE alocações ativas. Alocações inativas
 * (aluno transferido/removido) permanecem no histórico mas não ocupam vaga.
 */
describe("vagasTurma", () => {
  it("usa só a ocupação ativa (ignora histórico inativo)", () => {
    // Turma capacidade 10: 3 ativas + 4 inativas no histórico → ocupação ativa = 3.
    const ocupacaoAtiva = 3; // _count filtrado por { ativa: true }
    expect(vagasTurma(10, ocupacaoAtiva)).toBe(7);
  });

  it("turma cheia por alocações ativas não tem vaga", () => {
    expect(vagasTurma(8, 8)).toBe(0);
  });

  it("turma só com alocações inativas volta a ter todas as vagas", () => {
    // Todas as alocações foram desativadas → ocupação ativa = 0.
    expect(vagasTurma(6, 0)).toBe(6);
  });

  it("nunca retorna negativo mesmo se a ocupação exceder a capacidade", () => {
    expect(vagasTurma(5, 7)).toBe(0);
  });
});
