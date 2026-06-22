import { describe, it, expect, vi, beforeEach } from "vitest";
import { Papel, StatusCobranca } from "@prisma/client";

const findFirst = vi.fn();
vi.mock("@/lib/prisma", () => ({ prisma: { aluno: { findFirst: (...a: unknown[]) => findFirst(...a) } } }));

import { escopoFichaFinanceira, obterFichaFinanceira } from "./consultas";
import type { UsuarioSessao } from "@/server/_shared";

const u = (id: string, ...papeis: Papel[]): UsuarioSessao => ({ id, nome: "T", papeis });

// Escopo da matrícula ligada ao vendedor (comissão dele OU lead dele).
const escopoVendedor = (id: string) => ({
  matriculas: {
    some: {
      OR: [
        { comissoes: { some: { vendedorId: id } } },
        { lead: { vendedorDonoId: id } },
      ],
    },
  },
});

describe("escopoFichaFinanceira (visibilidade row-level, doc 07)", () => {
  it("sem usuário → sem restrição (compat. com chamadas internas)", () => {
    expect(escopoFichaFinanceira()).toEqual({});
  });

  it("papéis amplos (Financeiro/Secretaria/Pedagógico/Gerente/Admin) veem qualquer aluno", () => {
    expect(escopoFichaFinanceira(u("x", Papel.ADMINISTRADOR))).toEqual({});
    expect(escopoFichaFinanceira(u("x", Papel.FINANCEIRO))).toEqual({});
    expect(escopoFichaFinanceira(u("x", Papel.SECRETARIA_ACADEMICA))).toEqual({});
    expect(escopoFichaFinanceira(u("x", Papel.GERENTE_PEDAGOGICO))).toEqual({});
    expect(escopoFichaFinanceira(u("x", Papel.GERENTE_COMERCIAL))).toEqual({});
  });

  it("Vendedor só vê a ficha de alunos ligados a ele (comissão ou lead dele)", () => {
    expect(escopoFichaFinanceira(u("vend-1", Papel.VENDEDOR))).toEqual(escopoVendedor("vend-1"));
  });

  it("o escopo do vendedor usa o próprio id (não acessa ficha de terceiros)", () => {
    // O filtro carrega o id do vendedor logado: um aluno sem matrícula ligada a
    // ele não casa o `where` → consulta devolve null → acesso negado.
    expect(escopoFichaFinanceira(u("vend-2", Papel.VENDEDOR))).toEqual(escopoVendedor("vend-2"));
    expect(escopoFichaFinanceira(u("vend-2", Papel.VENDEDOR))).not.toEqual(escopoVendedor("vend-1"));
  });

  it("Vendedor que também é Financeiro vê todos (papel amplo prevalece)", () => {
    expect(escopoFichaFinanceira(u("x", Papel.VENDEDOR, Papel.FINANCEIRO))).toEqual({});
  });
});

// --- Filtragem row-level das matrículas retornadas na ficha (P1 residual) ---

// Helpers de fábrica para montar o aluno como o Prisma retornaria.
const cobranca = (valor: number, status: StatusCobranca) => ({
  status,
  vencimento: new Date("2030-01-01"),
  valorNegociado: valor,
  pagoEm: null,
});

const matricula = (
  id: string,
  opts: { vendedorComissao?: string; vendedorLead?: string | null; valorAberto?: number },
) => ({
  id,
  comissoes: opts.vendedorComissao
    ? [{ vendedorId: opts.vendedorComissao, vendedor: { nome: "V" } }]
    : [],
  lead: opts.vendedorLead !== undefined ? { vendedorDonoId: opts.vendedorLead } : null,
  cobrancas: [cobranca(opts.valorAberto ?? 0, StatusCobranca.PENDENTE)],
  ajustes: [{ id: `aj-${id}` }],
});

const alunoComMatriculas = (matriculas: ReturnType<typeof matricula>[]) => ({
  id: "aluno-1",
  pais: { nome: "BR" },
  responsaveis: [],
  matriculas,
});

describe("obterFichaFinanceira (filtragem row-level das matrículas, P1)", () => {
  beforeEach(() => findFirst.mockReset());

  it("Vendedor vê só suas matrículas/comissões/cobranças; matrícula de outro vendedor no mesmo aluno NÃO aparece", async () => {
    const minha = matricula("m-minha", { vendedorComissao: "vend-1", valorAberto: 100 });
    const outra = matricula("m-outra", { vendedorComissao: "vend-2", valorAberto: 999 });
    findFirst.mockResolvedValue(alunoComMatriculas([minha, outra]));

    const ficha = await obterFichaFinanceira("aluno-1", u("vend-1", Papel.VENDEDOR));

    expect(ficha).not.toBeNull();
    expect(ficha!.aluno.matriculas.map((m) => m.id)).toEqual(["m-minha"]);
    // Cobranças/ajustes/comissões aninhadas refletem só a matrícula visível.
    expect(ficha!.cobrancas).toHaveLength(1);
    expect(ficha!.ajustes.map((a) => a.id)).toEqual(["aj-m-minha"]);
    expect(ficha!.comissoes.every((c) => c.vendedorId === "vend-1")).toBe(true);
    // KPIs somam apenas o escopo do vendedor (100), não os 999 de terceiros.
    expect(ficha!.emAberto).toBe(100);
  });

  it("Vendedor enxerga matrícula vinda do SEU lead (mesmo sem comissão dele)", async () => {
    const porLead = matricula("m-lead", { vendedorLead: "vend-1", valorAberto: 50 });
    const deOutro = matricula("m-x", { vendedorComissao: "vend-9", valorAberto: 70 });
    findFirst.mockResolvedValue(alunoComMatriculas([porLead, deOutro]));

    const ficha = await obterFichaFinanceira("aluno-1", u("vend-1", Papel.VENDEDOR));

    expect(ficha!.aluno.matriculas.map((m) => m.id)).toEqual(["m-lead"]);
    expect(ficha!.emAberto).toBe(50);
  });

  it("Vendedor sem matrícula visível no aluno → ficha vazia coerente (nunca dados de terceiros)", async () => {
    const deOutro = matricula("m-x", { vendedorComissao: "vend-9", valorAberto: 70 });
    findFirst.mockResolvedValue(alunoComMatriculas([deOutro]));

    const ficha = await obterFichaFinanceira("aluno-1", u("vend-1", Papel.VENDEDOR));

    expect(ficha!.aluno.matriculas).toEqual([]);
    expect(ficha!.cobrancas).toEqual([]);
    expect(ficha!.comissoes).toEqual([]);
    expect(ficha!.emAberto).toBe(0);
  });

  it("Papel amplo (Financeiro) vê TODAS as matrículas do aluno (visão global)", async () => {
    const a = matricula("m-a", { vendedorComissao: "vend-1", valorAberto: 100 });
    const b = matricula("m-b", { vendedorComissao: "vend-2", valorAberto: 999 });
    findFirst.mockResolvedValue(alunoComMatriculas([a, b]));

    const ficha = await obterFichaFinanceira("aluno-1", u("fin", Papel.FINANCEIRO));

    expect(ficha!.aluno.matriculas.map((m) => m.id)).toEqual(["m-a", "m-b"]);
    expect(ficha!.emAberto).toBe(1099);
  });

  it("aluno fora do escopo (findFirst → null) retorna null", async () => {
    findFirst.mockResolvedValue(null);
    expect(await obterFichaFinanceira("aluno-1", u("vend-1", Papel.VENDEDOR))).toBeNull();
  });
});
