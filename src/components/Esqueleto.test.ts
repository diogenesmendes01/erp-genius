import { existsSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { EsqueletoAbas, EsqueletoColunas, EsqueletoConversas, EsqueletoLista } from "./Esqueleto";
import LoadingPipeline from "@/app/(app)/pipeline/loading";
import { COLUNAS } from "@/app/(app)/pipeline/colunas";

describe("Esqueleto", () => {
  it.each([
    ["lista", EsqueletoLista, "alunos"],
    ["abas", EsqueletoAbas, "financeiro"],
    ["conversas", EsqueletoConversas, "conversas"],
    ["colunas", EsqueletoColunas, "funil de leads"],
  ] as const)("%s: anuncia o que está carregando e marca a região como ocupada", (_, Componente, rotulo) => {
    const html = renderToStaticMarkup(createElement(Componente, { rotulo }));
    expect(html).toContain('aria-busy="true"');
    expect(html).toMatch(new RegExp(`<p(?=[^>]*\\brole="status")(?=[^>]*\\bclass="[^"]*\\bsr-only\\b)[^>]*>Carregando ${rotulo}</p>`));
  });

  it("o esqueleto do pipeline tem tantas colunas quanto o funil real", () => {
    const html = renderToStaticMarkup(createElement(LoadingPipeline));
    expect([...html.matchAll(/class="w-64 shrink-0/g)]).toHaveLength(COLUNAS.length);
    expect(COLUNAS.length).toBe(9);
  });

  it("esqueleto de formato específico fica no grupo da página-índice, não na raiz — senão as rotas filhas herdariam o formato errado", () => {
    const A = "src/app/(app)";
    for (const [secao, grupo] of [["alunos", "(lista)"], ["leads", "(lista)"], ["financeiro", "(painel)"]]) {
      expect(existsSync(`${A}/${secao}/loading.tsx`), `${secao}/loading.tsx`).toBe(false);
      expect(existsSync(`${A}/${secao}/${grupo}/loading.tsx`)).toBe(true);
      expect(existsSync(`${A}/${secao}/${grupo}/page.tsx`)).toBe(true);
    }
  });
});
