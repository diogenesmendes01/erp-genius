import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { papeisDoGuardArquivo } from "@/test/guard-pagina";

const mocks = vi.hoisted(() => ({
  usuario: { valor: { id: "u1", nome: "U", papeis: ["VENDEDOR"] as string[], permissoes: [] as string[] } },
  carregar: vi.fn(),
  coberturas: vi.fn(async () => ({ itens: [] as unknown[], possuiMais: false })),
  vendedoresBanco: vi.fn(async () => [{ id: "v1", nome: "Bia" }]),
  config: vi.fn(async () => ({ fusoInstitucional: "America/Sao_Paulo" })),
}));
vi.mock("@/server/_shared", () => ({ exigirSessaoPagina: async () => mocks.usuario.valor }));
vi.mock("@/lib/prisma", () => ({ prisma: { usuario: { findMany: mocks.vendedoresBanco }, configuracaoOperacional: { findUnique: mocks.config } } }));
vi.mock("@/server/crm/carteira", async (original) => ({ ...(await original<typeof import("@/server/crm/carteira")>()), carregarCarteira: mocks.carregar }));
vi.mock("@/server/crm/carteira-acoes", () => ({ reatribuirCarteiraEmLote: vi.fn() }));
vi.mock("@/server/acesso/consultas", () => ({ listarCoberturas: mocks.coberturas }));
vi.mock("@/server/acesso/coberturas", () => ({ concederCobertura: vi.fn(), revogarCobertura: vi.fn() }));
vi.mock("@/server/acesso/coberturas-local", () => ({ concederCoberturaLocal: vi.fn() }));
vi.mock("@/server/preferencias/fuso-exibicao", () => ({ consultarPreferenciaFusoEquipe: async () => ({ ok: true, dado: { fusoExibicao: null } }) }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }), usePathname: () => "/carteira", redirect: vi.fn() }));

import Page from "./page";
import { ConsequenciaReatribuicao } from "./ListaCarteira";
import { TEXTO_CONSEQUENCIA_REATRIBUICAO } from "@/server/crm/carteira";

const linha = { oportunidadeId: "o1", pessoaId: null, empresaId: null, nome: "Ana", tipo: "pf", etapa: "NOVO", dono: { id: "v1", nome: "Bia" }, diasSemInteracao: 3, turmaAtiva: null, tags: [] };
const vendedor = { id: "u1", nome: "U", papeis: ["VENDEDOR"], permissoes: [] };
const gerente = { id: "g1", nome: "G", papeis: ["GERENTE_COMERCIAL"], permissoes: [] };

async function renderPagina(usuario: typeof vendedor, sp: Record<string, string> = {}, linhas: unknown[] = [linha]) {
  mocks.usuario.valor = usuario;
  mocks.carregar.mockResolvedValue({ vendedores: [{ id: "v1", nome: "Bia", total: 1, cobertoPor: null }], linhas, total: linhas.length });
  return renderToStaticMarkup(await Page({ searchParams: Promise.resolve(sp) }));
}
const renderConfirmacaoReatribuir = () => renderToStaticMarkup(createElement(ConsequenciaReatribuicao, { quantidade: 2, para: "Bia" }));

describe("/carteira (página)", () => {
  beforeEach(() => { mocks.coberturas.mockClear(); mocks.carregar.mockClear(); });

  it("guard comercial", () => {
    expect(papeisDoGuardArquivo("src/app/(app)/carteira/page.tsx")).toEqual(["ADMINISTRADOR", "GERENTE_COMERCIAL", "VENDEDOR"]);
  });

  it("vendedor: título Minha carteira, sem trocar responsável e sem aba Coberturas", async () => {
    const html = await renderPagina(vendedor);
    expect(html).toContain("Minha carteira");
    expect(html).toContain("Ana");
    expect(html).not.toContain('aria-label="Mudar responsável"');
    expect(html).not.toContain("Selecionar Ana");
    expect(html).not.toContain("Conceder cobertura");
    expect(html).not.toContain("Coberturas");
    const pedindo = await renderPagina(vendedor, { aba: "coberturas" });
    expect(pedindo).not.toContain("Conceder cobertura");
    expect(mocks.coberturas).not.toHaveBeenCalled();
  });

  it("gerente: seleciona em lote e vê a aba Coberturas; conceder e vazio da lista", async () => {
    const carteira = await renderPagina(gerente);
    expect(carteira).toContain("Carteira");
    expect(carteira).toContain("Selecionar Ana");
    expect(carteira).toContain("Coberturas");
    const html = await renderPagina(gerente, { aba: "coberturas" });
    expect(html).toContain("Conceder cobertura");
    expect(html).toContain("Nenhuma cobertura cadastrada.");
    expect(mocks.coberturas).toHaveBeenCalledWith(expect.objectContaining({ id: "g1" }), 1);
  });

  it("vazio duplo: carteira vazia × filtro sem resultado", async () => {
    expect(await renderPagina(gerente, {}, [])).toContain("Nenhuma oportunidade na carteira.");
    const filtrado = await renderPagina(gerente, { tipo: "pj" }, []);
    expect(filtrado).toContain("Nenhuma oportunidade com esses filtros.");
    expect(mocks.carregar).toHaveBeenLastCalledWith(expect.anything(), expect.objectContaining({ tipo: "pj" }));
  });

  it("reatribuir mostra a consequência antes de confirmar", () => {
    const html = renderConfirmacaoReatribuir();
    expect(html).toContain(TEXTO_CONSEQUENCIA_REATRIBUICAO);
    expect(html).toContain("2 oportunidades passam para Bia.");
  });
});
