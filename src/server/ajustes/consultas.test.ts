import { describe, it, expect } from "vitest";
import { Papel } from "@prisma/client";
import { escopoFichaFinanceira } from "./consultas";
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
