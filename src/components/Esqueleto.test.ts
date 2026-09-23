import { existsSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { EsqueletoAbas, EsqueletoColunas, EsqueletoConversas, EsqueletoLista } from "./Esqueleto";

describe("Esqueleto", () => {
  it.each([
    ["lista", EsqueletoLista, "alunos"],
    ["abas", EsqueletoAbas, "financeiro"],
    ["conversas", EsqueletoConversas, "conversas"],
    ["colunas", EsqueletoColunas, "funil de leads"],
  ] as const)("%s: anuncia o que está carregando e marca a região como ocupada", (_, Componente, rotulo) => {
    const html = renderToStaticMarkup(createElement(Componente, { rotulo }));
    expect(html).toContain('aria-busy="true"');
    expect(html).toMatch(new RegExp(`<p class="sr-only" role="status">Carregando ${rotulo}</p>`));
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
