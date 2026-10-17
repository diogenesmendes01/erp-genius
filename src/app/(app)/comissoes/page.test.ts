import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { papeisDoGuardArquivo } from "@/test/guard-pagina";

const mocks = vi.hoisted(() => ({
  usuario: { valor: { id: "u1", nome: "U", papeis: ["VENDEDOR"] as string[], permissoes: [] as string[] } },
  carregar: vi.fn(),
}));
vi.mock("@/server/_shared", () => ({ exigirSessaoPagina: async () => mocks.usuario.valor }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    usuario: { findMany: async () => [{ id: "v1", nome: "Bia" }] },
    configuracaoOperacional: { findUnique: async () => ({ fusoInstitucional: "America/Sao_Paulo" }) },
  },
}));
vi.mock("@/server/crm/comissoes-painel", async (original) => ({ ...(await original<typeof import("@/server/crm/comissoes-painel")>()), carregarPainelComissoes: mocks.carregar }));

import Page from "./page";

const painel = {
  totais: [{ moeda: "CRC", status: "PAGA", valor: "1600.00" }],
  porVendedor: [{ vendedorId: "v1", nome: "Bia", moeda: "CRC", valor: "1600.00", quantidade: 1 }],
  porPolitica: [],
  evolucao: [{ mes: "2026-10", moeda: "CRC", valor: "1600.00" }],
  matriculadasSemComissao: [],
  linhas: [{ id: "c1", nome: "Ana Souza", produto: "Inglês · Online", vendedor: "Bia", base: "TAXA_MATRICULA", percentual: "5.00", valor: "1600.00", moeda: "CRC", status: "PAGA", competencia: new Date("2026-10-05T15:00:00Z") }],
  possuiMais: false,
};
const com = (papeis: string[]) => ({ id: "u1", nome: "U", papeis, permissoes: [] });
const vendedor = com(["VENDEDOR"]);
const financeiro = com(["FINANCEIRO"]);
const gerente = com(["GERENTE_COMERCIAL"]);

async function renderPagina(usuario: typeof vendedor, sp: Record<string, string> = {}) {
  mocks.usuario.valor = usuario;
  mocks.carregar.mockResolvedValue(painel);
  return renderToStaticMarkup(await Page({ searchParams: Promise.resolve(sp) }));
}

describe("/comissoes (página)", () => {
  beforeEach(() => mocks.carregar.mockClear());

  it("guard: administrador, financeiro, gerente comercial e vendedor", () => {
    expect(papeisDoGuardArquivo("src/app/(app)/comissoes/page.tsx")).toEqual(["ADMINISTRADOR", "FINANCEIRO", "GERENTE_COMERCIAL", "VENDEDOR"]);
  });

  it("vendedor: Minhas comissões e status Paga visível", async () => {
    const html = await renderPagina(vendedor);
    expect(html).toContain("Minhas comissões");
    expect(html).toContain("Paga");
    expect(html).not.toContain("Por vendedor");
    expect(mocks.carregar).toHaveBeenCalledWith(vendedor, expect.objectContaining({ periodo: "mes", vendedorId: undefined, pagina: 1 }));
  });

  it("vendedor não filtra por outro vendedor pela URL", async () => {
    await renderPagina(vendedor, { vendedor: "v1" });
    expect(mocks.carregar).toHaveBeenCalledWith(vendedor, expect.objectContaining({ vendedorId: undefined }));
  });

  it("cálculo legível e moeda em cada valor", async () => {
    const html = await renderPagina(financeiro);
    expect(html).toContain("5% da taxa de matrícula");
    expect(html).toMatch(/CRC\s?1\.600,00/);
    expect(html).toContain("Por vendedor");
  });

  it("Fechar mês continua em /financeiro/comissoes, só link para FINANCEIRO", async () => {
    expect(await renderPagina(financeiro)).toContain('href="/financeiro/comissoes"');
    expect(await renderPagina(gerente)).not.toContain("/financeiro/comissoes");
    expect(await renderPagina(vendedor)).not.toContain("/financeiro/comissoes");
  });

  it("tabela vira cartões no celular", async () => {
    const html = await renderPagina(vendedor);
    expect(html).toContain("md:table");
    expect(html).toContain("md:hidden");
  });

  it("período e vendedor da URL chegam ao carregamento", async () => {
    await renderPagina(gerente, { periodo: "ano", vendedor: "v1", pagina: "2" });
    expect(mocks.carregar).toHaveBeenCalledWith(gerente, { periodo: "ano", vendedorId: "v1", produtoId: undefined, pagina: 2 });
  });
});
