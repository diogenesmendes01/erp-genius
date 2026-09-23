import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { StatusComissao } from "@prisma/client";
import { Comissoes, Aprovacoes } from "./FinanceiroPainel";

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
      comissoes, podePagar: true, onFechar: () => {}, fechamentoAutomatico: false, onToggleAutomatico: () => {}, isPending: false,
    }));
    expect(html).toContain("Fechar mês e marcar pagas");
    expect(html).not.toMatch(/<button[^>]*\sdisabled=""[^>]*>Fechar/);
  });

  it("botão desabilitado e com o rótulo de progresso durante a operação, junto do toggle automático", () => {
    const html = renderToStaticMarkup(createElement(Comissoes, {
      comissoes, podePagar: true, onFechar: () => {}, fechamentoAutomatico: false, onToggleAutomatico: () => {}, isPending: true,
    }));
    expect(html).toContain("Fechando…");
    expect(html).toMatch(/<button[^>]*\sdisabled=""[^>]*>Fechando…<\/button>/);
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
