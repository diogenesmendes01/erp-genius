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

  it("mostra o texto de vazio recebido (filtro), não o genérico; sem ele, o genérico", () => {
    const comFiltro = renderToStaticMarkup(createElement(Comissoes, { ...base, comissoes: [], vazio: "Nenhuma comissão nesta situação." }));
    expect(comFiltro).toContain("Nenhuma comissão nesta situação.");
    expect(comFiltro).not.toContain("Sem comissões.");
    expect(renderToStaticMarkup(createElement(Comissoes, { ...base, comissoes: [] }))).toContain("Sem comissões.");
  });

  it("a aba repassa o vazio até a tabela", () => {
    const html = renderToStaticMarkup(createElement(ComissoesAba, { comissoes: [], aPagar: [], podePagar: false, fechamentoAutomatico: false, vazio: "Nenhuma comissão nesta situação." }));
    expect(html).toContain("Nenhuma comissão nesta situação.");
    expect(html).not.toContain("Sem comissões.");
  });
});
