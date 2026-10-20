import { existsSync } from "node:fs";
import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import * as Esqueletos from "./Esqueleto";
import { EsqueletoAcesso, EsqueletoCartoes, EsqueletoColunas, EsqueletoConversas, EsqueletoLista, EsqueletoPublico, EsqueletoSecao, EsqueletoTabela } from "./Esqueleto";

const titulos = (html: string) => html.split('data-esqueleto="titulo"').length - 1;

describe("Esqueleto", () => {
  it.each([
    ["lista", EsqueletoLista, "alunos"],
    ["tabela", EsqueletoTabela, "financeiro"],
    ["cartões", EsqueletoCartoes, "secretaria"],
    ["seção", EsqueletoSecao, "pendências da Secretaria"],
    ["conversas", EsqueletoConversas, "conversas"],
    ["colunas", EsqueletoColunas, "funil de leads"],
    ["acesso", EsqueletoAcesso, "acesso"],
    ["público", EsqueletoPublico, "pagamento"],
  ] as const)("%s: anuncia o que está carregando e marca a região como ocupada", (_, Componente, rotulo) => {
    const html = renderToStaticMarkup(createElement(Componente, { rotulo }));
    expect(html).toContain('aria-busy="true"');
    expect(html).toMatch(new RegExp(`<p(?=[^>]*\\brole="status")(?=[^>]*\\bclass="[^"]*\\bsr-only\\b)[^>]*>Carregando ${rotulo}</p>`));
  });

  it("todo esqueleto exportado passa pelo anúncio — um esqueleto novo sem ele não entra pela porta do loading.tsx", () => {
    // A trava estática (src/app/borda-rota.test.ts) aceita um loading.tsx que só renderiza um Esqueleto*:
    // o anúncio fica garantido aqui, para cada export, sem lista fixa.
    const exportados = Object.entries(Esqueletos).filter(([nome]) => nome.startsWith("Esqueleto"));
    expect(exportados.length).toBeGreaterThanOrEqual(8);
    for (const [nome, Componente] of exportados) {
      const html = renderToStaticMarkup(createElement(Componente as (p: { rotulo: string }) => ReactNode, { rotulo: "x" }));
      expect(html, nome).toMatch(/^<div[^>]*\baria-busy="true"/);
      expect(html, nome).toMatch(/<p(?=[^>]*\brole="status")[^>]*>Carregando x<\/p>/);
    }
  });

  it("no máximo um título por esqueleto; EsqueletoTabela e EsqueletoSecao vêm sem título (o layout ou a seção já o têm)", () => {
    expect(titulos(renderToStaticMarkup(createElement(EsqueletoLista, { rotulo: "x" })))).toBe(1);
    expect(titulos(renderToStaticMarkup(createElement(EsqueletoCartoes, { rotulo: "x", busca: true })))).toBe(1);
    expect(titulos(renderToStaticMarkup(createElement(EsqueletoConversas, { rotulo: "x" })))).toBe(1);
    expect(titulos(renderToStaticMarkup(createElement(EsqueletoColunas, { rotulo: "x" })))).toBe(1);
    expect(titulos(renderToStaticMarkup(createElement(EsqueletoAcesso, { rotulo: "x" })))).toBe(1);
    expect(titulos(renderToStaticMarkup(createElement(EsqueletoPublico, { rotulo: "x" })))).toBe(1);
    expect(titulos(renderToStaticMarkup(createElement(EsqueletoTabela, { rotulo: "x", indicadores: 4 })))).toBe(0);
    expect(titulos(renderToStaticMarkup(createElement(EsqueletoSecao, { rotulo: "x" })))).toBe(0);
  });

  it("cartões, indicadores e campos saem na quantidade pedida", () => {
    const cartoes = renderToStaticMarkup(createElement(EsqueletoCartoes, { rotulo: "x", cartoes: 4 }));
    expect([...cartoes.matchAll(/class="space-y-2 rounded-lg border border-gray-200 p-4"/g)]).toHaveLength(4);
    const tabela = renderToStaticMarkup(createElement(EsqueletoTabela, { rotulo: "x", indicadores: 4 }));
    expect([...tabela.matchAll(/class="animate-pulse rounded-md bg-gray-100 h-20"/g)]).toHaveLength(4);
    expect(renderToStaticMarkup(createElement(EsqueletoTabela, { rotulo: "x" }))).not.toContain("h-20");
    const acesso = renderToStaticMarkup(createElement(EsqueletoAcesso, { rotulo: "x" }));
    expect([...acesso.matchAll(/class="animate-pulse rounded-md bg-gray-100 h-9"/g)]).toHaveLength(3); // 2 campos + botão
  });

  it("esqueleto de formato específico fica no grupo da página-índice, não na raiz — senão as rotas filhas herdariam o formato errado", () => {
    const A = "src/app/(app)";
    for (const [secao, grupo] of [["alunos", "(lista)"], ["financeiro", "(painel)"]]) {
      expect(existsSync(`${A}/${secao}/loading.tsx`), `${secao}/loading.tsx`).toBe(false);
      expect(existsSync(`${A}/${secao}/${grupo}/loading.tsx`)).toBe(true);
      expect(existsSync(`${A}/${secao}/${grupo}/page.tsx`)).toBe(true);
    }
  });

  it("Esqueleto usa animate-pulse", () => {
    const h = renderToStaticMarkup(createElement(EsqueletoLista, { rotulo: "alunos" }));
    expect(h).toContain("animate-pulse");
    expect(h).toContain('data-esqueleto="titulo"');
  });
});
