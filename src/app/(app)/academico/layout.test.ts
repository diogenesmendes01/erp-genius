import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { Papel } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ sessao: vi.fn(), pathname: vi.fn() }));
vi.mock("@/server/_shared", () => ({ exigirSessaoPagina: mocks.sessao }));
vi.mock("next/navigation", () => ({ usePathname: mocks.pathname }));

import Layout from "./layout";

async function renderizar(papeis: Papel[], caminho: string) {
  mocks.sessao.mockResolvedValue({ id: "u1", papeis });
  mocks.pathname.mockReturnValue(caminho);
  return renderToStaticMarkup(await Layout({ children: createElement("main", null, "conteúdo") }));
}
const ativas = (html: string) => [...html.matchAll(/<a[^>]*aria-current="page"[^>]*>/g)].map((m) => m[0]);
const hrefs = (html: string) => [...html.matchAll(/<a[^>]*\shref="([^"]+)"/g)].map((m) => m[1]);

describe("layout de /academico", () => {
  beforeEach(() => { mocks.sessao.mockReset(); mocks.pathname.mockReset(); });

  it("barra de seções com as abas do papel, antes do conteúdo da página", async () => {
    const html = await renderizar([Papel.PROFESSOR], "/academico/avaliacoes");
    expect(html).toContain('aria-label="Seções do acadêmico"');
    expect(hrefs(html)).toEqual([
      "/academico", "/academico/avaliacoes", "/academico/recuperacoes", "/academico/recuperacoes/designadas",
      "/academico/segundas-chamadas/minhas", "/academico/indisponibilidades",
    ]);
    expect(html).not.toContain('href="/academico/regras"'); // Professor não abre Regras de avaliação
    expect(html.indexOf("Seções do acadêmico")).toBeLessThan(html.indexOf("<main>conteúdo</main>"));
  });

  it("o layout não decide acesso: pede só a sessão (sem papéis) — o guard é de cada página", async () => {
    await renderizar([Papel.GERENTE_PEDAGOGICO], "/academico");
    expect(mocks.sessao).toHaveBeenCalledWith();
  });

  it("prefixo aninhado: em Minhas recuperações acende só ela, não Recuperações", async () => {
    const html = await renderizar([Papel.PROFESSOR], "/academico/recuperacoes/designadas");
    const marcadas = ativas(html);
    expect(marcadas).toHaveLength(1);
    expect(marcadas[0]).toContain('href="/academico/recuperacoes/designadas"');
  });

  it("sub-tela do ramo acende a aba do ramo (prefixo mais longo que casa)", async () => {
    const html = await renderizar([Papel.PROFESSOR], "/academico/recuperacoes/planos/p1");
    const marcadas = ativas(html);
    expect(marcadas).toHaveLength(1);
    expect(marcadas[0]).toContain('href="/academico/recuperacoes"');
  });

  it("a raiz é exata: acende em /academico e não em sub-tela sem aba própria", async () => {
    const raiz = ativas(await renderizar([Papel.GERENTE_PEDAGOGICO], "/academico"));
    expect(raiz).toHaveLength(1);
    expect(raiz[0]).toContain('href="/academico"');
    // Segunda chamada de uma avaliação: nenhuma aba é dela — a barra fica sem marca, não mente "Mudanças acadêmicas".
    expect(ativas(await renderizar([Papel.GERENTE_PEDAGOGICO], "/academico/segundas-chamadas/a1/P1"))).toEqual([]);
  });

  it("prefixo próprio: a revisão de quantidade de uma modalidade acende Quantidade de aulas", async () => {
    const marcadas = ativas(await renderizar([Papel.SECRETARIA_ACADEMICA], "/academico/modalidades/m1/quantidade/propostas/p1"));
    expect(marcadas).toHaveLength(1);
    expect(marcadas[0]).toContain('href="/academico/modalidades/quantidade"');
  });

  it("borda de segmento: /academico/regras/turmas/t1 acende Regras de avaliação", async () => {
    const marcadas = ativas(await renderizar([Papel.GERENTE_PEDAGOGICO], "/academico/regras/turmas/t1"));
    expect(marcadas).toHaveLength(1);
    expect(marcadas[0]).toContain('href="/academico/regras"');
  });

  it("papel sem abas na área: só a página (o guard dela decide o acesso)", async () => {
    const html = await renderizar([Papel.FINANCEIRO], "/academico");
    expect(html).toBe("<main>conteúdo</main>");
  });
});
