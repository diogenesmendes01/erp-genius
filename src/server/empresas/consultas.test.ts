import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  empresa: { findMany: vi.fn(), count: vi.fn() },
  pais: { findMany: vi.fn() },
}));
vi.mock("@/lib/prisma", () => ({ prisma: db }));
vi.mock("@/server/_shared", () => ({ exigirSessaoComPapel: vi.fn(async () => ({ id: "u1" })), numero: Number, numeroOuNull: (v: unknown) => (v == null ? null : Number(v)) }));

import { listarEmpresasPagina } from "./consultas";
import { EMPRESAS_POR_PAGINA, lerFiltrosEmpresas } from "./filtros";

describe("lista de /empresas paginada (E4)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    db.empresa.findMany.mockResolvedValue([{ id: "e1", codigo: "E-1", nome: "Acme", paisId: "p1", ativo: true, _count: { matriculas: 3, faturas: 1 } }]);
    db.empresa.count.mockImplementation(async (args?: { where?: object }) => (args?.where ? 7 : 40));
    db.pais.findMany.mockResolvedValue([{ id: "p1", nome: "Costa Rica" }]);
  });

  it("página com filtros, desempate por id, contagem filtrada e total geral", async () => {
    const r = await listarEmpresasPagina(lerFiltrosEmpresas({ situacao: "ativas", pagina: "2" }));
    const consulta = db.empresa.findMany.mock.calls[0][0];
    expect(consulta).toMatchObject({ where: { AND: [{ ativo: true }] }, skip: EMPRESAS_POR_PAGINA, take: EMPRESAS_POR_PAGINA, orderBy: [{ criadoEm: "desc" }, { id: "desc" }] });
    expect(db.empresa.count).toHaveBeenCalledWith({ where: { AND: [{ ativo: true }] } });
    expect(r).toMatchObject({ total: 7, totalBase: 40, itens: [{ id: "e1", pais: "Costa Rica", colaboradores: 3 }] });
  });

  it("nomes de país só dos países da página (não a tabela inteira)", async () => {
    await listarEmpresasPagina(lerFiltrosEmpresas({}));
    expect(db.pais.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { id: { in: ["p1"] } } }));
  });
});
