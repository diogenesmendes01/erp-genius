import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { papeisDoGuardArquivo } from "@/test/guard-pagina";

const mocks = vi.hoisted(() => ({
  usuario: { valor: { id: "u1", nome: "U", papeis: ["VENDEDOR"], permissoes: [] as string[] } },
  carregar: vi.fn(),
  listarFiltros: vi.fn(async () => [] as unknown[]),
  obter: vi.fn(async () => null as unknown),
  historico: vi.fn(async () => [] as unknown[]),
  vendedores: vi.fn(async () => [{ id: "v1", nome: "Bia" }]),
  paises: vi.fn(async () => [] as unknown[]),
  config: vi.fn(async () => ({ fusoInstitucional: "America/Costa_Rica" })),
  cliente: vi.fn((props: Record<string, unknown>) => createElement("div", { "data-cliente": "" }, props.vazio as never)),
}));
vi.mock("@/server/_shared", () => ({ exigirSessaoPagina: async () => mocks.usuario.valor }));
vi.mock("@/server/crm/funil", async (original) => ({ ...(await original<typeof import("@/server/crm/funil")>()), carregarFunil: mocks.carregar }));
vi.mock("@/server/crm/filtros-salvos", () => ({ listarFiltros: mocks.listarFiltros }));
vi.mock("@/server/crm/historico", () => ({ obterOportunidade: mocks.obter, historicoOportunidade: mocks.historico }));
vi.mock("@/server/comercial/consultas", () => ({ listarVendedores: mocks.vendedores }));
vi.mock("@/server/paises/consultas", () => ({ listarPaisesOperacionais: mocks.paises }));
vi.mock("@/lib/prisma", () => ({ prisma: { configuracaoOperacional: { findUnique: mocks.config } } }));
vi.mock("./FunilCliente", () => ({ FunilCliente: mocks.cliente }));

import Page from "./page";

const semOportunidades = [{ etapa: "NOVO", total: 0, somaPorMoeda: [], cartoes: [], possuiMais: false }];
const comOportunidade = [{ etapa: "NOVO", total: 1, somaPorMoeda: [], cartoes: [{ id: "o1" }], possuiMais: false }];

async function renderPagina(sp: Record<string, string>, colunas: unknown, usuario: { permissoes: string[] } = { permissoes: [] }) {
  mocks.carregar.mockResolvedValue(colunas);
  mocks.usuario.valor = { id: "u1", nome: "U", papeis: ["VENDEDOR"], ...usuario };
  return renderToStaticMarkup(await Page({ searchParams: Promise.resolve(sp) }));
}

describe("/funil (página)", () => {
  beforeEach(() => { Object.values(mocks).forEach((m) => "mockClear" in m && m.mockClear()); });

  it("guard comercial", () => {
    expect(papeisDoGuardArquivo("src/app/(app)/funil/page.tsx")).toEqual(["ADMINISTRADOR", "GERENTE_COMERCIAL", "VENDEDOR"]);
  });

  it("vazio duplo: carteira vazia × filtro sem resultado", async () => {
    expect(await renderPagina({}, semOportunidades)).toContain("Nenhuma oportunidade na sua carteira.");
    const filtrado = await renderPagina({ temperatura: "QUENTE" }, semOportunidades);
    expect(filtrado).toContain("Nenhuma oportunidade com esses filtros.");
    expect(filtrado).not.toContain("na sua carteira");
  });

  it("exportar só com a capacidade, levando os filtros", async () => {
    expect(await renderPagina({}, comOportunidade, { permissoes: [] })).not.toContain("/api/exportacoes/leads");
    const com = await renderPagina({ temperatura: "QUENTE", busca: "ana" }, comOportunidade, { permissoes: ["dados.exportar_leads"] });
    expect(com).toContain("/api/exportacoes/leads?busca=ana&amp;temperatura=QUENTE");
  });

  it("?o abre o painel só com a oportunidade dentro da carteira; ?modo=lista chega ao cliente", async () => {
    mocks.obter.mockResolvedValueOnce({ id: "o1", nome: "Ana" });
    await renderPagina({ o: "o1", modo: "lista" }, comOportunidade);
    expect(mocks.obter).toHaveBeenCalledWith("o1", expect.objectContaining({ id: "u1" }));
    expect(mocks.cliente.mock.calls.at(-1)?.[0]).toMatchObject({ modo: "lista", aberta: { oportunidade: { id: "o1" } } });
    await renderPagina({ o: "alheia" }, comOportunidade);
    expect(mocks.cliente.mock.calls.at(-1)?.[0]).toMatchObject({ modo: "quadro", aberta: null, oportunidadeNaoEncontrada: true });
  });
});
