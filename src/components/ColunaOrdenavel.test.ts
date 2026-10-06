import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ColunaOrdenavel } from "./ColunaOrdenavel";
import type { Ordenacao } from "@/lib/ordenacao";

const render = (ordenacao: Ordenacao | null, extra: Partial<Parameters<typeof ColunaOrdenavel>[0]> = {}) =>
  renderToStaticMarkup(createElement("table", null, createElement("thead", null, createElement("tr", null,
    createElement(ColunaOrdenavel, { campo: "nome", rotulo: "Aluno", ordenacao, rota: "/alunos", parametros: { busca: "ana", status: "ATIVO" }, ...extra })))));

const href = (html: string) => html.match(/href="([^"]*)"/)?.[1].replaceAll("&amp;", "&");

describe("ColunaOrdenavel", () => {
  it("coluna em ordem crescente: aria-sort=ascending; o link inverte para decrescente e diz isso", () => {
    const html = render({ campo: "nome", dir: "asc" });
    expect(html).toMatch(/<th scope="col" aria-sort="ascending" class="px-4 py-2 font-medium">/);
    expect(href(html)).toBe("/alunos?busca=ana&status=ATIVO&ordem=nome&dir=desc");
    expect(html).toContain('<span class="sr-only">: ordenar em ordem decrescente</span>');
    expect(html).toContain('data-direcao="asc"');
  });

  it("coluna em ordem decrescente: aria-sort=descending; o link volta para crescente", () => {
    const html = render({ campo: "nome", dir: "desc" });
    expect(html).toContain('aria-sort="descending"');
    expect(href(html)).toBe("/alunos?busca=ana&status=ATIVO&ordem=nome&dir=asc");
    expect(html).toContain(": ordenar em ordem crescente");
    expect(html).toContain('data-direcao="desc"');
  });

  it("outra coluna ordenada (ou nenhuma): sem aria-sort (só a coluna ordenada o tem); o link aplica a direção inicial desta", () => {
    const outra = render({ campo: "status", dir: "desc" });
    expect(outra).not.toContain("aria-sort");
    expect(href(outra)).toBe("/alunos?busca=ana&status=ATIVO&ordem=nome&dir=asc");
    expect(outra).toContain('data-direcao="nenhuma"');
    const nenhuma = render(null, { direcaoInicial: "desc" });
    expect(nenhuma).not.toContain("aria-sort");
    expect(href(nenhuma)).toBe("/alunos?busca=ana&status=ATIVO&ordem=nome&dir=desc");
    expect(nenhuma).toContain(": ordenar em ordem decrescente");
  });

  it("zera a página e substitui a ordem anterior, preservando os demais parâmetros", () => {
    const html = render({ campo: "nome", dir: "asc" }, { parametros: { busca: "ana", pagina: "4", ordem: "status", dir: "desc", pais: "p1" } });
    expect(href(html)).toBe("/alunos?busca=ana&pais=p1&ordem=nome&dir=desc");
  });

  it("o rótulo é um link real e a seta é só visual (aria-hidden); classe do cabeçalho substituível", () => {
    const html = render(null, { className: "p-3" });
    expect(html).toMatch(/<th scope="col" class="p-3"><a [^>]*href="[^"]+"[^>]*>Aluno<span class="sr-only">/);
    expect(html).toMatch(/<svg[^>]*aria-hidden="true"/);
  });
});
