import { Papel } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

// #204 C1 (B17 da triagem): o filtro de vendedor da lista "Matriculadas sem comissão" só tinha prova na
// integração (comissoes-painel.int.test.ts), que fica fora do CI. Aqui o Prisma é mockado e o teste lê o
// `where` montado: `vendedorDonoId` entra no mesmo AND do escopo, nunca no lugar dele.
const m = vi.hoisted(() => ({
  oportunidades: vi.fn(),
  escopoComercial: vi.fn(),
}));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    configuracaoOperacional: { findUnique: async () => ({ fusoInstitucional: "America/Sao_Paulo" }) },
    comissao: { groupBy: async () => [], findMany: async () => [] },
    oportunidade: { findMany: m.oportunidades },
    usuario: { findMany: async () => [] },
    politicaComissao: { findMany: async () => [] },
  },
}));
vi.mock("@/server/financeiro/consultas", () => ({ escopoComissoes: () => ({}) }));
vi.mock("@/server/_shared/escopo-comercial", () => ({ escopoComercialAtual: m.escopoComercial }));

import { carregarPainelComissoes } from "./comissoes-painel";

const ESCOPO_GERENTE = { OR: [{ vendedorDonoId: { in: ["v1", "v2"] } }] };
const ETAPA = { etapa: "MATRICULADO", matricula: { is: { status: { notIn: ["CANCELADA", "ENCERRADA"] }, comissoes: { none: {} } } } };
const usuario = (papel: Papel) => ({ id: "u1", nome: "U", papeis: [papel] }) as Parameters<typeof carregarPainelComissoes>[0];
const carregar = (papel: Papel, vendedorId?: string) => carregarPainelComissoes(usuario(papel), { periodo: "mes", vendedorId, pagina: 1 });
const whereDasPendencias = () => {
  expect(m.oportunidades).toHaveBeenCalledTimes(1);
  return m.oportunidades.mock.calls[0][0].where;
};

beforeEach(() => {
  m.oportunidades.mockReset().mockResolvedValue([{ id: "op1", nome: "Ana" }]);
  m.escopoComercial.mockReset().mockResolvedValue(ESCOPO_GERENTE);
});

describe("carregarPainelComissoes — where de \"Matriculadas sem comissão\" (#204 C1)", () => {
  it("gerente com vendedor filtrado: escopo, etapa e vendedorDonoId no MESMO AND (o filtro não afrouxa o escopo)", async () => {
    const painel = await carregar(Papel.GERENTE_COMERCIAL, "v9");
    expect(whereDasPendencias()).toEqual({ AND: [ESCOPO_GERENTE, ETAPA, { vendedorDonoId: "v9" }] });
    expect(painel.matriculadasSemComissao).toEqual([{ oportunidadeId: "op1", nome: "Ana" }]);
  });

  it("gerente sem vendedor filtrado: só escopo e etapa, sem vendedorDonoId", async () => {
    await carregar(Papel.GERENTE_COMERCIAL);
    const where = whereDasPendencias();
    expect(where).toEqual({ AND: [ESCOPO_GERENTE, ETAPA] });
    expect(JSON.stringify(where)).not.toContain("v9");
  });

  it.each([Papel.FINANCEIRO, Papel.ADMINISTRADOR])("%s com vendedor filtrado: escopo aberto ({}) e o vendedor no AND", async (papel) => {
    await carregar(papel, "v9");
    expect(whereDasPendencias()).toEqual({ AND: [{}, ETAPA, { vendedorDonoId: "v9" }] });
    expect(m.escopoComercial).not.toHaveBeenCalled();
  });

  it("sem período: a lista de pendências não leva datas no where (é de todos os períodos)", async () => {
    await carregar(Papel.FINANCEIRO, "v9");
    expect(JSON.stringify(whereDasPendencias())).not.toMatch(/aprovadaEm|criadoEm/);
  });

  it("VENDEDOR: nenhuma consulta de pendências, lista vazia", async () => {
    const painel = await carregar(Papel.VENDEDOR, "v9");
    expect(m.oportunidades).not.toHaveBeenCalled();
    expect(painel.matriculadasSemComissao).toEqual([]);
  });
});
