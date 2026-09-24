import { beforeEach, describe, expect, it, vi } from "vitest";
import { Papel } from "@prisma/client";

const m = vi.hoisted(() => ({
  sessao: vi.fn(),
  aluno: vi.fn(), lead: vi.fn(), empresa: vi.fn(),
}));
vi.mock("@/lib/prisma", () => ({ prisma: { aluno: { findFirst: m.aluno }, lead: { findFirst: m.lead }, empresa: { findUnique: m.empresa } } }));
vi.mock("@/server/_shared", () => ({ exigirSessao: m.sessao }));
vi.mock("@/server/_shared/escopo-comercial", () => ({ escopoComercialAtual: async () => ({ vendedorDonoId: { in: ["v1"] } }) }));
// Espelha o fail-closed real: professor vê as suas turmas; visão ampla vê tudo; resto, nada.
vi.mock("@/server/alunos/consultas", () => ({
  escopoAlunos: (u: { papeis: string[] }) =>
    u.papeis.includes("SECRETARIA_ACADEMICA") || u.papeis.includes("ADMINISTRADOR") ? {}
      : u.papeis.includes("PROFESSOR") ? { alocacoes: "da-turma" } : { id: { in: [] } },
}));

import { tituloAluno, tituloEmpresa, tituloLead } from "./titulos-registro";

const u = (...papeis: Papel[]) => ({ id: "u1", nome: "U", papeis });

describe("títulos de aba das fichas (E2)", () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it("aluno: nome no escopo da página; fora do escopo ou sem sessão, título genérico", async () => {
    m.sessao.mockResolvedValue(u(Papel.PROFESSOR));
    m.aluno.mockResolvedValueOnce({ primeiroNome: "Ana", sobrenome: "Souza" });
    expect(await tituloAluno("a1")).toBe("Ana Souza · Aluno");
    expect(m.aluno.mock.calls[0][0].where).toEqual({ AND: [{ id: "a1" }, { alocacoes: "da-turma" }] });
    m.aluno.mockResolvedValueOnce(null);
    expect(await tituloAluno("a2")).toBe("Aluno");
    m.sessao.mockRejectedValueOnce(new Error("sem sessão"));
    expect(await tituloAluno("a1")).toBe("Aluno");
  });

  it("lead: só papéis comerciais consultam, sempre no escopo da carteira", async () => {
    m.sessao.mockResolvedValue(u(Papel.PROFESSOR));
    expect(await tituloLead("l1")).toBe("Lead");
    expect(m.lead).not.toHaveBeenCalled();
    m.sessao.mockResolvedValue(u(Papel.VENDEDOR));
    m.lead.mockResolvedValueOnce({ nome: "Bia" });
    expect(await tituloLead("l1")).toBe("Bia · Lead");
    expect(m.lead.mock.calls[0][0].where).toEqual({ AND: [{ id: "l1" }, { vendedorDonoId: { in: ["v1"] } }] });
    // Cada papel que abre a ficha do lead também lê o título.
    for (const papel of [Papel.ADMINISTRADOR, Papel.GERENTE_COMERCIAL]) {
      m.sessao.mockResolvedValue(u(papel));
      m.lead.mockResolvedValueOnce({ nome: "Caio" });
      expect(await tituloLead("l2"), papel).toBe("Caio · Lead");
    }
  });

  it("empresa: só financeiro/admin consultam", async () => {
    m.sessao.mockResolvedValue(u(Papel.VENDEDOR));
    expect(await tituloEmpresa("e1")).toBe("Empresa");
    expect(m.empresa).not.toHaveBeenCalled();
    m.sessao.mockResolvedValue(u(Papel.FINANCEIRO));
    m.empresa.mockResolvedValueOnce({ nome: "Acme" });
    expect(await tituloEmpresa("e1")).toBe("Acme · Empresa");
    m.sessao.mockResolvedValue(u(Papel.ADMINISTRADOR));
    m.empresa.mockResolvedValueOnce({ nome: "Beta" });
    expect(await tituloEmpresa("e2")).toBe("Beta · Empresa");
  });
});
