import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  papeis: { valor: ["GERENTE_COMERCIAL"] as string[] },
  pagina: vi.fn(async () => ({ itens: [] as unknown[], total: 120, totalBase: 400 })),
  vendedores: vi.fn(async () => [{ id: "v1", nome: "Bia" }]),
  redirect: vi.fn((destino: string) => { throw new Error(`REDIRECT ${destino}`); }),
  exportar: vi.fn((props: { query?: string }) => createElement("a", { "data-query": props.query ?? "" })),
  lista: vi.fn((props: Record<string, unknown>) => createElement("div", { "data-lista": JSON.stringify(props.filtros) })),
}));
vi.mock("@/server/_shared", () => ({
  exigirSessaoPagina: async () => ({ id: "u1", nome: "U", papeis: mocks.papeis.valor }),
  podeAtribuirOutroDono: (papeis: string[]) => papeis.includes("GERENTE_COMERCIAL") || papeis.includes("ADMINISTRADOR"),
}));
vi.mock("@/server/comercial/consultas", () => ({ listarLeadsPagina: mocks.pagina, listarVendedores: mocks.vendedores }));
vi.mock("@/server/paises/consultas", () => ({ listarPaisesOperacionais: async () => [] }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("@/components/ExportarPlanilha", () => ({ ExportarPlanilha: mocks.exportar }));
vi.mock("../LeadsLista", () => ({ LeadsLista: mocks.lista }));

import LeadsPage from "./page";

const pagina = async (params: Record<string, string>) => renderToStaticMarkup(await LeadsPage({ searchParams: Promise.resolve(params) }));

describe("/leads (página)", () => {
  beforeEach(() => { Object.values(mocks).forEach((m) => "mockClear" in m && m.mockClear()); mocks.papeis.valor = ["GERENTE_COMERCIAL"]; });

  it("os filtros da URL chegam à consulta paginada", async () => {
    await pagina({ etapa: "NOVO", busca: "ana", pagina: "2" });
    expect(mocks.pagina).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ etapa: "NOVO", busca: "ana", pagina: 2 }));
  });

  it("página além do fim redireciona para a última, preservando os filtros", async () => {
    await expect(pagina({ etapa: "NOVO", pagina: "9" })).rejects.toThrow("REDIRECT /leads?etapa=NOVO&pagina=3");
  });

  it("o botão de exportar leva os filtros aplicados (sem a página)", async () => {
    await pagina({ temperatura: "QUENTE", busca: "ana", pagina: "2" });
    expect(mocks.exportar.mock.calls[0][0]).toMatchObject({ tipo: "leads", query: "busca=ana&temperatura=QUENTE" });
  });

  it("gerente filtra por dono da equipe; dono fora da equipe é descartado", async () => {
    await pagina({ dono: "v1" });
    expect(mocks.pagina).toHaveBeenLastCalledWith(expect.anything(), expect.objectContaining({ donoId: "v1" }));
    expect(mocks.lista.mock.calls.at(-1)?.[0]).toMatchObject({ donos: [{ id: "v1", nome: "Bia" }] });
    await pagina({ dono: "alheio" });
    expect(mocks.pagina).toHaveBeenLastCalledWith(expect.anything(), expect.objectContaining({ donoId: null }));
  });

  it("vendedor não recebe o filtro por dono (a carteira já é só a dele)", async () => {
    mocks.papeis.valor = ["VENDEDOR"];
    await pagina({ dono: "v1" });
    expect(mocks.pagina).toHaveBeenLastCalledWith(expect.anything(), expect.objectContaining({ donoId: null }));
    expect(mocks.lista.mock.calls.at(-1)?.[0]).toMatchObject({ donos: [] });
  });
});
