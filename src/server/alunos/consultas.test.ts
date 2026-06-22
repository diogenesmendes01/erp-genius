import { describe, it, expect } from "vitest";
import { Papel } from "@prisma/client";
import { escopoAlunos } from "./consultas";
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
