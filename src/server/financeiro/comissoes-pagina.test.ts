import { beforeEach, describe, expect, it, vi } from "vitest";
import { Papel } from "@prisma/client";

const m = vi.hoisted(() => ({ findMany: vi.fn(), count: vi.fn(), groupBy: vi.fn(), sessao: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ prisma: { comissao: { findMany: m.findMany, count: m.count, groupBy: m.groupBy } } }));
vi.mock("@/server/_shared", async (original) => ({ ...(await original<object>()), exigirSessaoComPapel: m.sessao }));

import { Prisma } from "@prisma/client";
import { COMISSOES_POR_PAGINA, condicoesBuscaComissoes, listarComissoesPagina, totaisComissoesAPagar } from "./consultas";

describe("listarComissoesPagina (E4)", () => {
  beforeEach(() => { vi.clearAllMocks(); m.findMany.mockResolvedValue([]); m.count.mockResolvedValue(0); });

  it("vendedor: situação em AND com o escopo (só as dele), página e desempate", async () => {
    m.sessao.mockResolvedValue({ id: "v1", papeis: [Papel.VENDEDOR] });
    await listarComissoesPagina({ status: "PAGA", pagina: 3 });
    const consulta = m.findMany.mock.calls[0][0];
    expect(consulta.where).toEqual({ AND: [{ vendedorId: "v1" }, { status: "PAGA" }] });
    expect(consulta).toMatchObject({ skip: 2 * COMISSOES_POR_PAGINA, take: COMISSOES_POR_PAGINA });
    expect(consulta.orderBy.at(-1)).toEqual({ id: "desc" });
    expect(m.count).toHaveBeenCalledWith({ where: consulta.where });
  });

  it("ordem (E1): sem ela, a de sempre; com ela, a coluna pedida no banco, antes da página, com desempate por id", async () => {
    m.sessao.mockResolvedValue({ id: "f1", papeis: [Papel.FINANCEIRO] });
    await listarComissoesPagina({ status: null, pagina: 1 });
    expect(m.findMany.mock.calls[0][0].orderBy).toEqual([{ vendedor: { nome: "asc" } }, { criadoEm: "desc" }, { id: "desc" }]);
    await listarComissoesPagina({ status: null, pagina: 2, ordem: { campo: "valor", dir: "desc" } });
    // Valores de moedas diferentes não se comparam: agrupa por moeda e ordena dentro de cada uma.
    expect(m.findMany.mock.calls[1][0]).toMatchObject({ orderBy: [{ moeda: "asc" }, { valor: "desc" }, { id: "desc" }], skip: COMISSOES_POR_PAGINA, take: COMISSOES_POR_PAGINA });
    await listarComissoesPagina({ status: null, pagina: 1, ordem: { campo: "status", dir: "asc" } });
    expect(m.findMany.mock.calls[2][0].orderBy).toEqual([{ status: "asc" }, { vendedor: { nome: "asc" } }, { criadoEm: "desc" }, { id: "desc" }]);
    await listarComissoesPagina({ status: null, pagina: 1, ordem: { campo: "vendedor", dir: "desc" } });
    expect(m.findMany.mock.calls[3][0].orderBy).toEqual([{ vendedor: { nome: "desc" } }, { criadoEm: "desc" }, { id: "desc" }]);
  });

  it("gerente: as suas e as da equipe; financeiro: todas", async () => {
    m.sessao.mockResolvedValue({ id: "g1", papeis: [Papel.GERENTE_COMERCIAL] });
    await listarComissoesPagina({ status: null, pagina: 1 });
    expect(m.findMany.mock.calls[0][0].where).toEqual({ AND: [{ OR: [{ vendedorId: "g1" }, { vendedor: { gerenteComercialId: "g1" } }] }, {}] });
    m.sessao.mockResolvedValue({ id: "f1", papeis: [Papel.FINANCEIRO] });
    await listarComissoesPagina({ status: null, pagina: 1 });
    expect(m.findMany.mock.calls[1][0].where).toEqual({ AND: [{}, {}] });
  });
});

describe("listarComissoesPagina — busca (E4, §5.6 A9)", () => {
  beforeEach(() => { vi.clearAllMocks(); m.findMany.mockResolvedValue([]); m.count.mockResolvedValue(0); });

  it("palavras no nome do beneficiário, em AND com o escopo e a situação; a contagem usa o mesmo where", async () => {
    m.sessao.mockResolvedValue({ id: "v1", papeis: [Papel.VENDEDOR] });
    await listarComissoesPagina({ status: "PAGA", busca: "  bia   souza ", pagina: 1 });
    const consulta = m.findMany.mock.calls[0][0];
    expect(consulta.where).toEqual({
      AND: [
        { vendedorId: "v1" },
        { status: "PAGA" },
        { vendedor: { nome: { contains: "bia", mode: "insensitive" } } },
        { vendedor: { nome: { contains: "souza", mode: "insensitive" } } },
      ],
    });
    expect(m.count).toHaveBeenCalledWith({ where: consulta.where });
  });

  it("sem busca (vazia ou só espaços) nada muda no where", async () => {
    m.sessao.mockResolvedValue({ id: "f1", papeis: [Papel.FINANCEIRO] });
    await listarComissoesPagina({ status: null, busca: "   ", pagina: 1 });
    expect(m.findMany.mock.calls[0][0].where).toEqual({ AND: [{}, {}] });
    expect(condicoesBuscaComissoes("")).toEqual([]);
  });

  it("teto de 6 palavras: a 7ª em diante é descartada (limita o tamanho da consulta)", () => {
    const condicoes = condicoesBuscaComissoes("a b c d e f g h");
    expect(condicoes).toHaveLength(6);
    expect(JSON.stringify(condicoes)).not.toContain('"g"');
  });
});

describe("totaisComissoesAPagar (aba de comissões do /financeiro)", () => {
  beforeEach(() => vi.clearAllMocks());

  it("agrega no banco as APROVADAS de todo o escopo, por moeda — não a página exibida", async () => {
    m.sessao.mockResolvedValue({ id: "g1", papeis: [Papel.GERENTE_COMERCIAL] });
    m.groupBy.mockResolvedValue([
      { moeda: "CRC", _sum: { valor: new Prisma.Decimal("5000.50") }, _count: { _all: 3 } },
      { moeda: "USD", _sum: { valor: null }, _count: { _all: 0 } },
    ]);
    // A quantidade por moeda alimenta a confirmação do fechamento do mês ("N comissões, total X").
    expect(await totaisComissoesAPagar()).toEqual([{ moeda: "CRC", valor: 5000.5, quantidade: 3 }, { moeda: "USD", valor: 0, quantidade: 0 }]);
    const consulta = m.groupBy.mock.calls[0][0];
    expect(consulta).toMatchObject({ by: ["moeda"], _sum: { valor: true }, _count: { _all: true } });
    expect(consulta.where).toEqual({ AND: [{ OR: [{ vendedorId: "g1" }, { vendedor: { gerenteComercialId: "g1" } }] }, { status: "APROVADA" }] });
    expect(consulta).not.toHaveProperty("take");
  });
});
