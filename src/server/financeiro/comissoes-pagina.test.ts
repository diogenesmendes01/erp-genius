import { beforeEach, describe, expect, it, vi } from "vitest";
import { Papel } from "@prisma/client";

const m = vi.hoisted(() => ({ findMany: vi.fn(), count: vi.fn(), groupBy: vi.fn(), sessao: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ prisma: { comissao: { findMany: m.findMany, count: m.count, groupBy: m.groupBy } } }));
vi.mock("@/server/_shared", async (original) => ({ ...(await original<object>()), exigirSessaoComPapel: m.sessao }));

import { Prisma } from "@prisma/client";
import { COMISSOES_POR_PAGINA, listarComissoesPagina, totaisComissoesAPagar } from "./consultas";

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

  it("gerente: as suas e as da equipe; financeiro: todas", async () => {
    m.sessao.mockResolvedValue({ id: "g1", papeis: [Papel.GERENTE_COMERCIAL] });
    await listarComissoesPagina({ status: null, pagina: 1 });
    expect(m.findMany.mock.calls[0][0].where).toEqual({ AND: [{ OR: [{ vendedorId: "g1" }, { vendedor: { gerenteComercialId: "g1" } }] }, {}] });
    m.sessao.mockResolvedValue({ id: "f1", papeis: [Papel.FINANCEIRO] });
    await listarComissoesPagina({ status: null, pagina: 1 });
    expect(m.findMany.mock.calls[1][0].where).toEqual({ AND: [{}, {}] });
  });
});

describe("totaisComissoesAPagar (aba de comissões do /financeiro)", () => {
  beforeEach(() => vi.clearAllMocks());

  it("agrega no banco as APROVADAS de todo o escopo, por moeda — não a página exibida", async () => {
    m.sessao.mockResolvedValue({ id: "g1", papeis: [Papel.GERENTE_COMERCIAL] });
    m.groupBy.mockResolvedValue([{ moeda: "CRC", _sum: { valor: new Prisma.Decimal("5000.50") } }, { moeda: "USD", _sum: { valor: null } }]);
    expect(await totaisComissoesAPagar()).toEqual([{ moeda: "CRC", valor: 5000.5 }, { moeda: "USD", valor: 0 }]);
    const consulta = m.groupBy.mock.calls[0][0];
    expect(consulta).toMatchObject({ by: ["moeda"], _sum: { valor: true } });
    expect(consulta.where).toEqual({ AND: [{ OR: [{ vendedorId: "g1" }, { vendedor: { gerenteComercialId: "g1" } }] }, { status: "APROVADA" }] });
    expect(consulta).not.toHaveProperty("take");
  });
});
