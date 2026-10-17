import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { EtapaLead } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";
import { COLUNAS_FUNIL } from "@/server/crm/etapas";
import type { CartaoFunil, ColunaFunil } from "@/server/crm/funil";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: () => {} }) }));
vi.mock("@/server/comercial/acoes", () => ({ moverEtapa: vi.fn() }));

import { QuadroFunil } from "./QuadroFunil";
import { ListaFunil } from "./ListaFunil";

const AGORA = new Date("2026-10-16T15:00:00Z");
const dias = (n: number) => new Date(AGORA.getTime() - n * 86_400_000);

const cartao: CartaoFunil = {
  id: "op1",
  codigo: "L-000001",
  nome: "Maria Souza",
  b2b: false,
  etapa: EtapaLead.NOVO,
  temperatura: "FRIO",
  valorPrevisto: "85000",
  moeda: "CRC",
  pais: "CR",
  dono: { id: "u1", nome: "Ana Vendedora" },
  proximaAcao: "Ligar",
  proximoFollowUp: dias(2),
  dataExperimental: null,
  etapaDesde: dias(3),
  ultimaAcaoEm: dias(1),
  tags: [],
  pessoaId: "p1",
};

const colunasFixture: ColunaFunil[] = COLUNAS_FUNIL.map((etapa) => {
  const cartoes = etapa === EtapaLead.NOVO ? [{ ...cartao }] : [];
  return {
    etapa,
    total: cartoes.length,
    somaPorMoeda: cartoes.length ? [{ moeda: "CRC", valor: "85000" }] : [],
    cartoes,
    possuiMais: false,
  };
});

const render = (p: { colunas?: ColunaFunil[]; podeMover?: boolean }) =>
  renderToStaticMarkup(
    createElement(QuadroFunil, {
      colunas: p.colunas ?? colunasFixture,
      podeMover: p.podeMover ?? false,
      aoAbrir: () => {},
      aoPedirAcao: () => {},
      agora: AGORA,
      fuso: "America/Sao_Paulo",
    }),
  );

describe("QuadroFunil", () => {
  it("10 colunas, contagem e soma por moeda; Matriculado e Perdido recolhidas", () => {
    const html = render({ colunas: colunasFixture });
    expect(html.match(/data-coluna="/g)).toHaveLength(10);
    expect(html).toContain("CRC 85.000,00");
    expect(html).toMatch(/data-coluna="PERDIDO"[^>]*data-recolhida="true"/);
    expect(html).toMatch(/data-coluna="MATRICULADO"[^>]*data-recolhida="true"/);
    expect(html).toMatch(/data-coluna="NOVO"[^>]*data-recolhida="false"/);
  });
  it("cartão mostra código, dono, dias na etapa, próxima ação vencida e temperatura com rótulo", () => {
    const html = render({ colunas: colunasFixture });
    expect(html).toContain("L-000001");
    expect(html).toContain("Ana Vendedora");
    expect(html).toContain("Há 3 dias nesta etapa");
    expect(html).toMatch(/class="[^"]*text-red-700[^"]*"[^>]*>Ligar · venceu/);
    expect(html).toContain('aria-label="Temperatura: Frio"');
  });
  it("teclado e toque: alça de arraste com rótulo e instruções em pt-BR", () => {
    const html = render({ colunas: colunasFixture, podeMover: true });
    expect(html).toContain('aria-roledescription="cartão arrastável"');
    expect(html).toContain("Pressione espaço para pegar; use as setas para trocar de coluna.");
    expect(html).toContain("touch-none");
    expect(html).toContain('aria-label="Arrastar cartão de Maria Souza"');
  });
  it("sem permissão de mover não há alça", () => {
    expect(render({ colunas: colunasFixture, podeMover: false })).not.toContain("cartão arrastável");
  });
  it("celular: seletor de etapa exibida", () => {
    expect(render({})).toContain('aria-label="Etapa exibida"');
  });
});

describe("ListaFunil", () => {
  it("tabela com caixa de seleção sempre visível e cabeçalhos ordenáveis", () => {
    const html = renderToStaticMarkup(
      createElement(ListaFunil, { colunas: colunasFixture, aoAbrir: () => {}, selecionados: ["op1"], aoSelecionar: () => {}, agora: AGORA, fuso: "America/Sao_Paulo" }),
    );
    expect(html).toContain("<table");
    expect(html).toContain('aria-label="Selecionar Maria Souza"');
    expect(html).toMatch(/aria-label="Selecionar Maria Souza"[^>]*checked/);
    expect(html).toContain('aria-label="Selecionar todas as oportunidades"');
    expect(html).toContain("L-000001");
  });
});
