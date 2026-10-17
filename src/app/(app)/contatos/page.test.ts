import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { papeisDoGuardArquivo } from "@/test/guard-pagina";

const mocks = vi.hoisted(() => ({
  usuario: { valor: { id: "u1", nome: "U", papeis: ["VENDEDOR"], permissoes: [] as string[] } },
  listar: vi.fn(),
  obter: vi.fn(async () => null as unknown),
  historico: vi.fn(async () => [] as unknown[]),
  campos: vi.fn(async () => [] as unknown[]),
  pares: vi.fn(async () => [] as unknown[]),
  mesclaveis: vi.fn(async () => new Map()),
  tags: vi.fn(async () => [] as unknown[]),
  vendedores: vi.fn(async () => [{ id: "v1", nome: "Bia" }]),
  paises: vi.fn(async () => [] as unknown[]),
  config: vi.fn(async () => ({ fusoInstitucional: "America/Costa_Rica" })),
  lista: vi.fn((props: Record<string, unknown>) => createElement("div", { "data-lista": "" }, props.filtrando ? "filtrando" : "")),
  ficha: vi.fn((props: Record<string, unknown>) => createElement("div", { "data-ficha": "" }, (props.detalhe as { nome: string }).nome)),
}));
vi.mock("@/server/_shared", () => ({ exigirSessaoPagina: async () => mocks.usuario.valor }));
vi.mock("@/server/crm/contatos", async (original) => ({
  ...(await original<typeof import("@/server/crm/contatos")>()),
  listarContatos: mocks.listar,
  obterContato: mocks.obter,
}));
vi.mock("@/server/crm/historico", () => ({ historicoPessoa: mocks.historico }));
vi.mock("@/server/crm/ficha-dados", () => ({ camposDaPessoa: mocks.campos, paresDuplicados: mocks.pares, pessoasMesclaveis: mocks.mesclaveis, tagsAtivas: mocks.tags }));
vi.mock("@/server/comercial/consultas", () => ({ listarVendedores: mocks.vendedores }));
vi.mock("@/server/paises/consultas", () => ({ listarPaisesOperacionais: mocks.paises }));
vi.mock("@/lib/prisma", () => ({ prisma: { configuracaoOperacional: { findUnique: mocks.config } } }));
vi.mock("./ListaContatos", () => ({ ListaContatos: mocks.lista }));
vi.mock("./FichaContato", () => ({ FichaContato: mocks.ficha }));

import Page from "./page";

async function renderPagina(sp: Record<string, string>, papeis: string[] = ["VENDEDOR"], permissoes: string[] = []) {
  mocks.listar.mockResolvedValue({ itens: [{ id: "p1", tipo: "pessoa" }], total: 1, possuiMais: false });
  mocks.usuario.valor = { id: "u1", nome: "U", papeis, permissoes };
  return renderToStaticMarkup(await Page({ searchParams: Promise.resolve(sp) }));
}
const props = (m: { mock: { calls: unknown[][] } }) => m.mock.calls.at(-1)?.[0] as Record<string, unknown>;

describe("/contatos (página)", () => {
  beforeEach(() => { Object.values(mocks).forEach((m) => "mockClear" in m && m.mockClear()); mocks.obter.mockResolvedValue(null); });

  it("guard com SECRETARIA", () => {
    // papeisDoGuardArquivo devolve os papéis em ordem alfabética.
    expect(papeisDoGuardArquivo("src/app/(app)/contatos/page.tsx")).toEqual(["ADMINISTRADOR", "GERENTE_COMERCIAL", "SECRETARIA_ACADEMICA", "VENDEDOR"]);
  });

  it("?tipo=empresas chega à consulta como filtro de empresas", async () => {
    await renderPagina({ tipo: "empresas" });
    expect(mocks.listar.mock.calls.at(-1)?.[1]).toMatchObject({ tipo: "empresas" });
    expect(props(mocks.lista)).toMatchObject({ filtrando: true });
  });

  it("?c abre a ficha só com a pessoa dentro do escopo; fora dele, avisa e não abre", async () => {
    mocks.obter.mockResolvedValueOnce({ id: "p1", nome: "Ana" });
    const html = await renderPagina({ c: "p1" });
    expect(mocks.obter).toHaveBeenCalledWith("p1", expect.objectContaining({ id: "u1" }));
    expect(html).toContain("data-ficha");
    expect(mocks.historico).toHaveBeenCalledWith("p1", expect.anything(), "tudo");
    const fora = await renderPagina({ c: "alheia" });
    expect(fora).not.toContain("data-ficha");
    expect(fora).toContain("Contato não encontrado na sua carteira.");
  });

  it("filtro do histórico vem da URL e abre a aba", async () => {
    mocks.obter.mockResolvedValueOnce({ id: "p1", nome: "Ana" });
    await renderPagina({ c: "p1", hist: "notas" });
    expect(mocks.historico).toHaveBeenCalledWith("p1", expect.anything(), "notas");
    expect(props(mocks.ficha)).toMatchObject({ filtroHistorico: "notas", abaInicial: "historico" });
  });

  it("secretaria não carrega vendedores, países nem duplicados e não é do comercial", async () => {
    await renderPagina({}, ["SECRETARIA_ACADEMICA"]);
    expect(mocks.vendedores).not.toHaveBeenCalled();
    expect(mocks.paises).not.toHaveBeenCalled();
    expect(mocks.pares).not.toHaveBeenCalled();
    expect(props(mocks.lista)).toMatchObject({ comercial: false, podeImportar: false, podeMesclar: false });
  });

  it("gerente importa e mescla; exportar exige a permissão de exportação", async () => {
    await renderPagina({}, ["GERENTE_COMERCIAL"]);
    expect(props(mocks.lista)).toMatchObject({ comercial: true, podeImportar: true, podeMesclar: true, podeExportar: false });
    expect(mocks.pares).toHaveBeenCalled();
    await renderPagina({}, ["GERENTE_COMERCIAL"], ["dados.exportar_contatos"]);
    expect(props(mocks.lista)).toMatchObject({ podeExportar: true });
  });

  it("com a ficha aberta a lista some no celular (só uma das duas)", async () => {
    mocks.obter.mockResolvedValueOnce({ id: "p1", nome: "Ana" });
    const html = await renderPagina({ c: "p1" });
    expect(html).toContain("max-[699px]:hidden");
    expect(await renderPagina({})).not.toContain("max-[699px]:hidden");
  });
});
