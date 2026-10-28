import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  empresa: { findMany: vi.fn(), findFirst: vi.fn(), count: vi.fn() },
  pais: { findMany: vi.fn() },
}));
const sessao = vi.hoisted(() => vi.fn(async () => ({ id: "u1", nome: "U", papeis: ["FINANCEIRO"] as string[] })));
const escopo = vi.hoisted(() => vi.fn(async () => ({ vendedorDonoId: { in: ["u1"] } })));
vi.mock("@/lib/prisma", () => ({ prisma: db }));
vi.mock("@/server/_shared", () => ({ exigirSessaoComPapel: sessao, numero: Number, numeroOuNull: (v: unknown) => (v == null ? null : Number(v)) }));
vi.mock("@/server/_shared/escopo-comercial", () => ({ escopoComercialAtual: escopo }));

import { listarEmpresasPagina, obterEmpresa } from "./consultas";
import { EMPRESAS_POR_PAGINA, lerFiltrosEmpresas } from "./filtros";

describe("lista de /empresas paginada (E4)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    db.empresa.findMany.mockResolvedValue([{ id: "e1", codigo: "E-1", nome: "Acme", paisId: "p1", ativo: true, _count: { matriculas: 3, faturas: 1 } }]);
    db.empresa.count.mockImplementation(async (args?: { where?: object }) => (args?.where ? 7 : 40));
    db.pais.findMany.mockResolvedValue([{ id: "p1", nome: "Costa Rica" }]);
    sessao.mockResolvedValue({ id: "u1", nome: "U", papeis: ["FINANCEIRO"] });
  });

  it("página com filtros, desempate por id, contagem filtrada e total geral", async () => {
    const r = await listarEmpresasPagina(lerFiltrosEmpresas({ situacao: "ativas", pagina: "2" }));
    const consulta = db.empresa.findMany.mock.calls[0][0];
    expect(consulta).toMatchObject({ where: { AND: [{ ativo: true }] }, skip: EMPRESAS_POR_PAGINA, take: EMPRESAS_POR_PAGINA, orderBy: [{ criadoEm: "desc" }, { id: "desc" }] });
    expect(db.empresa.count).toHaveBeenCalledWith({ where: { AND: [{ ativo: true }] } });
    expect(r).toMatchObject({ total: 7, totalBase: 40, itens: [{ id: "e1", pais: "Costa Rica", colaboradores: 3 }] });
  });

  it("ordem da URL (E1) vira o orderBy da consulta paginada, com desempate por id", async () => {
    await listarEmpresasPagina(lerFiltrosEmpresas({ ordem: "colaboradores", dir: "desc", pagina: "2" }));
    expect(db.empresa.findMany.mock.calls[0][0]).toMatchObject({
      orderBy: [{ matriculas: { _count: "desc" } }, { nomeOrdenacao: "asc" }, { id: "asc" }],
      skip: EMPRESAS_POR_PAGINA,
      take: EMPRESAS_POR_PAGINA,
    });
    await listarEmpresasPagina(lerFiltrosEmpresas({ ordem: "faturas", dir: "desc" }));
    expect(db.empresa.findMany.mock.calls[1][0].orderBy).toEqual([{ criadoEm: "desc" }, { id: "desc" }]);
  });

  it.each(["VENDEDOR", "GERENTE_COMERCIAL"])("%s só vê empresas ligadas à carteira ou à equipe", async (papel) => {
    sessao.mockResolvedValue({ id: "u1", nome: "U", papeis: [papel] });
    await listarEmpresasPagina(lerFiltrosEmpresas({ situacao: "ativas" }));
    const escopoLead = { vendedorDonoId: { in: ["u1"] } };
    const vinculo = { OR: [
      { oportunidades: { some: escopoLead } },
      { pessoas: { some: { oportunidades: { some: escopoLead } } } },
      { matriculas: { some: { lead: { is: escopoLead } } } },
    ] };
    expect(escopo).toHaveBeenCalled();
    expect(db.empresa.findMany.mock.calls[0][0].where).toEqual({ AND: [{ AND: [{ ativo: true }] }, vinculo] });
    expect(db.empresa.count).toHaveBeenCalledWith({ where: vinculo });
  });

  it("financeiro com papel comercial continua vendo o catálogo inteiro", async () => {
    sessao.mockResolvedValue({ id: "u1", nome: "U", papeis: ["FINANCEIRO", "GERENTE_COMERCIAL"] });
    await listarEmpresasPagina(lerFiltrosEmpresas({ situacao: "ativas" }));
    expect(db.empresa.findMany.mock.calls[0][0].where).toEqual({ AND: [{ ativo: true }] });
    expect(escopo).not.toHaveBeenCalled();
  });

  it.each(["VENDEDOR", "GERENTE_COMERCIAL"])("ficha de %s filtra colaboradores e omite faturas de outras carteiras", async (papel) => {
    sessao.mockResolvedValue({ id: "u1", nome: "U", papeis: [papel] });
    db.empresa.findFirst.mockResolvedValue(null);
    expect(await obterEmpresa("e1")).toBeNull();
    const consulta = db.empresa.findFirst.mock.calls[0][0];
    const escopoLead = { vendedorDonoId: { in: ["u1"] } };
    expect(consulta.where).toEqual({
      id: "e1",
      OR: [
        { oportunidades: { some: escopoLead } },
        { pessoas: { some: { oportunidades: { some: escopoLead } } } },
        { matriculas: { some: { lead: { is: escopoLead } } } },
      ],
    });
    expect(consulta.include.matriculas.where).toEqual({ lead: { is: escopoLead } });
    expect(consulta.include.faturas.where).toEqual({ id: { in: [] } });
  });

  it("ficha financeira carrega matrículas e faturas sem corte de carteira", async () => {
    db.empresa.findFirst.mockResolvedValue(null);
    expect(await obterEmpresa("e1")).toBeNull();
    const consulta = db.empresa.findFirst.mock.calls[0][0];
    expect(consulta.where).toEqual({ id: "e1" });
    expect(consulta.include.matriculas.where).toBeUndefined();
    expect(consulta.include.faturas.where).toBeUndefined();
  });

  it("nomes de país só dos países da página (não a tabela inteira)", async () => {
    await listarEmpresasPagina(lerFiltrosEmpresas({}));
    expect(db.pais.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { id: { in: ["p1"] } } }));
  });
});
