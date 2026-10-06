import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { StatusComissao } from "@prisma/client";
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: () => {} }) }));

import { Comissoes, ComissoesAba, Aprovacoes } from "./FinanceiroPainel";

const comissoes = [
  { id: "c1", vendedor: "Bia", valor: 100, moeda: "BRL", percentual: 10, status: StatusComissao.APROVADA },
];

const aprovacoes = [{
  id: "a1", solicitante: "Bia", tipo: "DESCONTO" as const, motivo: "Motivo", vigencia: null,
  impactoMensal: 50, alunoNome: "Ana", valorDe: 200, valorPara: 150, descontoValor: 50, moeda: "BRL",
}];

describe("Comissoes — botão de fechamento não permite duplo clique", () => {
  it("botão habilitado e com o rótulo padrão quando não há operação em andamento", () => {
    const html = renderToStaticMarkup(createElement(Comissoes, {
      comissoes, aPagar: [], podePagar: true, onFechar: () => {}, fechamentoAutomatico: false, onToggleAutomatico: () => {}, isPending: false,
    }));
    expect(html).toContain("Fechar mês e marcar pagas");
    expect(html).not.toMatch(/<button[^>]*\sdisabled=""[^>]*>Fechar/);
  });

  it("botão e toggle desabilitados durante qualquer operação em andamento — sem trocar o texto para 'Fechando…', que mentiria se a operação em voo for o toggle, não o fechamento", () => {
    const html = renderToStaticMarkup(createElement(Comissoes, {
      comissoes, aPagar: [], podePagar: true, onFechar: () => {}, fechamentoAutomatico: false, onToggleAutomatico: () => {}, isPending: true,
    }));
    expect(html).toMatch(/<button[^>]*\sdisabled=""[^>]*>Fechar mês e marcar pagas<\/button>/);
    expect(html).toMatch(/<input[^>]*type="checkbox"[^>]*\sdisabled=""/);
  });
});

describe("Comissoes — cabeçalhos ordenáveis (E1)", () => {
  const base = { comissoes, aPagar: [], podePagar: false, onFechar: () => {}, fechamentoAutomatico: false, onToggleAutomatico: () => {}, isPending: false };

  it("com a ordem da página: Vendedor, Valor e Status ordenáveis, a coluna atual marcada, filtros preservados", () => {
    const html = renderToStaticMarkup(createElement(Comissoes, {
      ...base, ordenacao: { atual: { campo: "valor", dir: "desc" }, rota: "/financeiro/comissoes", parametros: { status: "APROVADA" } },
    }));
    expect(html.match(/aria-sort="/g)).toHaveLength(1);
    expect(html).toMatch(/aria-sort="descending"[^>]*><a [^>]*href="\/financeiro\/comissoes\?status=APROVADA&amp;ordem=valor&amp;dir=asc"[^>]*>Valor</);
    expect(html).toMatch(/<th scope="col"(?! aria-sort)[^>]*><a [^>]*href="\/financeiro\/comissoes\?status=APROVADA&amp;ordem=vendedor&amp;dir=asc"[^>]*>Vendedor</);
    expect(html).toMatch(/<th scope="col"(?! aria-sort)[^>]*><a [^>]*href="\/financeiro\/comissoes\?status=APROVADA&amp;ordem=status&amp;dir=asc"[^>]*>Status</);
    // "%" não ordena (percentual e valor fixo misturados na mesma coluna).
    expect(html).toContain('<th class="px-4 py-2 font-medium">%</th>');
  });

  it("sem coluna de valor ordenada: o 1º clique em Valor ordena do maior para o menor (R1 da #136, B6)", () => {
    const html = renderToStaticMarkup(createElement(Comissoes, {
      ...base, ordenacao: { atual: { campo: "vendedor", dir: "asc" }, rota: "/financeiro/comissoes", parametros: {} },
    }));
    expect(html).toContain('href="/financeiro/comissoes?ordem=valor&amp;dir=desc"');
    expect(html).toContain('Valor<span class="sr-only">: ordenar em ordem decrescente</span>');
  });

  it("sem ordem (outro uso do componente): cabeçalhos simples, sem aria-sort", () => {
    const html = renderToStaticMarkup(createElement(Comissoes, base));
    expect(html).not.toContain("aria-sort");
    expect(html).toContain('<th class="px-4 py-2 font-medium">Vendedor</th>');
  });
});

describe("Aprovacoes — botões de decisão não permitem duplo clique", () => {
  it("Aprovar e Rejeitar habilitados quando não há operação em andamento", () => {
    const html = renderToStaticMarkup(createElement(Aprovacoes, { aprovacoes, onDecidir: () => {}, isPending: false }));
    expect(html).not.toMatch(/<button[^>]*\sdisabled=""/);
  });

  it("Aprovar e Rejeitar desabilitados durante a operação — mesmo que a decisão seja de outro item", () => {
    const html = renderToStaticMarkup(createElement(Aprovacoes, { aprovacoes, onDecidir: () => {}, isPending: true }));
    const desabilitados = [...html.matchAll(/<button[^>]*\sdisabled=""[^>]*>/g)];
    expect(desabilitados).toHaveLength(2);
  });
});

describe("Comissoes — total a pagar (E4: lista paginada)", () => {
  it("mostra o total das aprovadas recebido do servidor, não a soma da página exibida", () => {
    // A página tem uma aprovada de R$ 100; o escopo inteiro tem R$ 5.000 a pagar.
    const html = renderToStaticMarkup(createElement(Comissoes, {
      comissoes, aPagar: [{ moeda: "BRL", valor: 5000 }], podePagar: false, onFechar: () => {}, fechamentoAutomatico: false, onToggleAutomatico: () => {}, isPending: false,
    }));
    expect(html).toMatch(/A pagar \(aprovadas\): <strong>R\$\s5\.000,00<\/strong>/);
  });
});

describe("Comissoes — lista vazia (E4: filtro sem resultado)", () => {
  const base = { aPagar: [], podePagar: false, onFechar: () => {}, fechamentoAutomatico: false, onToggleAutomatico: () => {}, isPending: false };
  // A forma real vinda da página: um nó React com texto e o link "Ver todas" (não só string).
  const vazioReal = createElement("span", null, "Nenhuma comissão nesta situação. ", createElement("a", { href: "/financeiro/comissoes" }, "Ver todas"));

  it("mostra o texto de vazio recebido (filtro), não o genérico; sem ele, o genérico", () => {
    const comFiltro = renderToStaticMarkup(createElement(Comissoes, { ...base, comissoes: [], vazio: "Nenhuma comissão nesta situação." }));
    expect(comFiltro).toContain("Nenhuma comissão nesta situação.");
    expect(comFiltro).not.toContain("Sem comissões.");
    expect(renderToStaticMarkup(createElement(Comissoes, { ...base, comissoes: [] }))).toContain("Sem comissões.");
  });

  it("o vazio em forma de nó React (texto + link Ver todas) chega à tabela, na lista e na aba", () => {
    for (const html of [
      renderToStaticMarkup(createElement(Comissoes, { ...base, comissoes: [], vazio: vazioReal })),
      renderToStaticMarkup(createElement(ComissoesAba, { comissoes: [], aPagar: [], podePagar: false, fechamentoAutomatico: false, vazio: vazioReal })),
    ]) {
      expect(html).toContain("Nenhuma comissão nesta situação.");
      expect(html).toContain('<a href="/financeiro/comissoes">Ver todas</a>');
      expect(html).not.toContain("Sem comissões.");
    }
  });

  it("a aba repassa o vazio até a tabela", () => {
    const html = renderToStaticMarkup(createElement(ComissoesAba, { comissoes: [], aPagar: [], podePagar: false, fechamentoAutomatico: false, vazio: "Nenhuma comissão nesta situação." }));
    expect(html).toContain("Nenhuma comissão nesta situação.");
    expect(html).not.toContain("Sem comissões.");
  });
});
