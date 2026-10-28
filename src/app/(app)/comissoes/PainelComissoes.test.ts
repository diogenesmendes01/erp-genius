import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("@/server/crm/comissoes-estorno-acao", () => ({ estornarComissaoDoPainel: vi.fn() }));

import { PainelComissoes } from "./PainelComissoes";
import type { PainelComissoes as Painel } from "@/server/crm/comissoes-painel";

const linha = {
  id: "c1", nome: "Ana Souza", produto: "Inglês · Online", vendedor: "Vera", base: "TAXA_MATRICULA",
  percentual: "5.00", valor: "1600.00", moeda: "CRC", status: "PAGA" as const,
  competencia: new Date("2026-10-05T15:00:00Z"), previsaoPagamento: null,
  matriculaId: "m1", alunoId: "al1", oportunidadeId: "o1",
};

const painel: Painel = {
  totais: [], porVendedor: [], porPolitica: [], evolucao: [], matriculadasSemComissao: [],
  linhas: [linha], possuiMais: false, diaPrevisaoPagamento: 10,
};

describe("PainelComissoes · aluno clicável", () => {
  it("o_nome_abre_a_preparacao_da_matricula", () => {
    const html = renderToStaticMarkup(createElement(PainelComissoes, {
      painel, periodo: "mes", pagina: 1, vendedorId: "", vendedores: [], veTodos: false,
      podeFecharMes: false, fuso: "UTC", hrefPagina: (n) => `/comissoes?pagina=${n}`,
    }));
    expect(html).toContain('href="/matriculas/m1/preparacao"');
    expect(html).toContain("Ana Souza");
  });

  it("financeiro_sem_acesso_ve_o_nome_sem_link_de_preparacao", () => {
    const html = renderToStaticMarkup(createElement(PainelComissoes, {
      painel, periodo: "mes", pagina: 1, vendedorId: "", vendedores: [], veTodos: true,
      podeFecharMes: true, podeAbrirPreparacao: false, fuso: "UTC", hrefPagina: () => "/comissoes",
    }));
    expect(html).toContain("Ana Souza");
    expect(html).not.toContain("/matriculas/m1/preparacao");
    expect(html).not.toContain("/funil?o=o1");
  });

  it("sem_matricula_abre_a_oportunidade_no_funil", () => {
    const html = renderToStaticMarkup(createElement(PainelComissoes, {
      painel: { ...painel, linhas: [{ ...linha, matriculaId: "", oportunidadeId: "o9" }] },
      periodo: "mes", pagina: 1, vendedorId: "", vendedores: [], veTodos: false,
      podeFecharMes: false, fuso: "UTC", hrefPagina: () => "/comissoes",
    }));
    expect(html).toContain('href="/funil?o=o9"');
  });
});
