import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  papeis: vi.fn(async () => ["FINANCEIRO"] as string[] | null),
  pagina: vi.fn(async () => ({ itens: [] as unknown[], total: 120, totalBase: 400 })),
  redirect: vi.fn((destino: string) => { throw new Error(`REDIRECT ${destino}`); }),
  lista: vi.fn((props: Record<string, unknown>) => createElement("div", { "data-filtros": JSON.stringify(props.filtros) })),
}));
vi.mock("@/lib/guards", () => ({ exigirPapelLeitura: mocks.papeis }));
vi.mock("@/server/empresas/consultas", () => ({ listarEmpresasPagina: mocks.pagina }));
vi.mock("@/server/paises/consultas", () => ({ listarPaisesSimples: async () => [{ id: "p1", nome: "Costa Rica" }] }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("@/components/AcessoNegado", () => ({ AcessoNegado: () => createElement("p", null, "Acesso negado") }));
vi.mock("./EmpresasCliente", () => ({ EmpresasCliente: mocks.lista }));

import EmpresasPage from "./page";

const pagina = async (params: Record<string, string>) => renderToStaticMarkup(await EmpresasPage({ searchParams: Promise.resolve(params) }));

describe("/empresas (página)", () => {
  beforeEach(() => { Object.values(mocks).forEach((m) => m.mockClear()); });

  it("filtros da URL (saneados) chegam à consulta paginada", async () => {
    await pagina({ busca: "acme", pais: "antigo", situacao: "ativas", pagina: "2" });
    expect(mocks.pagina).toHaveBeenCalledWith(expect.objectContaining({ busca: "acme", paisId: null, situacao: "ativas", pagina: 2 }));
  });

  it("página além do fim redireciona para a última, preservando os filtros", async () => {
    await expect(pagina({ situacao: "ativas", pagina: "9" })).rejects.toThrow("REDIRECT /empresas?situacao=ativas&pagina=3");
  });

  it("sem papel: acesso negado, sem consultar", async () => {
    mocks.papeis.mockResolvedValueOnce(null);
    expect(await pagina({})).toContain("Acesso negado");
    expect(mocks.pagina).not.toHaveBeenCalled();
  });
});
