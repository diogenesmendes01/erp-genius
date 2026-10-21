import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

const caminho = vi.hoisted(() => ({ valor: "/home" }));
vi.mock("next/navigation", () => ({ usePathname: () => caminho.valor }));

import { Trilha } from "./Trilha";

const render = (c: string) => { caminho.valor = c; return renderToStaticMarkup(createElement(Trilha)); };

describe("Trilha", () => {
  it("na área em si (um nível), não aparece — o menu basta", () => {
    expect(render("/home")).toBe("");
    expect(render("/rota-desconhecida/x")).toBe("");
  });

  it("lista ordenada nomeada; ancestrais como links e a página atual com aria-current", () => {
    const html = render("/alunos/clx1a2b3c/financeiro");
    expect(html).toContain('aria-label="Trilha de navegação"');
    expect(html).toMatch(/<ol[\s\S]*<\/ol>/);
    expect(html).toContain('<a class="hover:text-gray-800 hover:underline" href="/alunos">Alunos</a>');
    expect(html).toContain('href="/alunos/clx1a2b3c">Ficha do aluno</a>');
    expect(html).toContain('<span aria-current="page" class="text-gray-700">Financeiro</span>');
    // O separador é decorativo.
    expect(html).toMatch(/<span aria-hidden="true"[^>]*>\/<\/span>/);
  });
});
