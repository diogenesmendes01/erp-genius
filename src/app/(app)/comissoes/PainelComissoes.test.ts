import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import { describe, expect, it, vi } from "vitest";
import { CLASSES_TOM } from "@/components/BadgeEstado";
import { CONTROLE_CAMPO } from "@/components/Campo";

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

describe("PainelComissoes · design system", () => {
  const fonte = readFileSync("src/app/(app)/comissoes/PainelComissoes.tsx", "utf8");

  it("a fonte usa os primitivos e não traz borda cinza nem badge ad-hoc", () => {
    expect(fonte).toContain("Avatar");
    expect(fonte).toContain("BadgeEstado");
    expect(fonte).toContain("CampoSelect");
    expect(fonte).toContain("CampoCombobox");
    expect(fonte).toContain("LinhaCampo");
    expect(fonte).toContain("font-mono");
    expect(fonte).toContain("tabular-nums");
    expect(fonte).not.toContain("border-gray-300");
    for (const cor of ["bg-green-100", "bg-amber-100", "bg-blue-100", "bg-red-100", "bg-yellow-100"]) {
      expect(fonte).not.toContain(cor);
    }
  });

  it("filtros, totais, resumo por vendedor e lançamentos renderizam avatar, badge, mono e controle", () => {
    const html = renderToStaticMarkup(createElement(PainelComissoes, {
      painel: {
        ...painel,
        totais: [
          { moeda: "CRC", status: "PENDENTE", valor: "10.00" },
          { moeda: "CRC", status: "APROVADA", valor: "20.00" },
          { moeda: "CRC", status: "PAGA", valor: "1600.00" },
          { moeda: "CRC", status: "ESTORNADA", valor: "5.00" },
        ],
        porVendedor: [{ vendedorId: "v1", nome: "Vera Lima", moeda: "CRC", valor: "1600.00", quantidade: 2 }],
      },
      periodo: "mes", pagina: 1, vendedorId: "", vendedores: [{ id: "v1", nome: "Vera Lima" }], veTodos: true,
      podeFecharMes: false, fuso: "UTC", hrefPagina: (n) => `/comissoes?pagina=${n}`,
    }));
    expect(html).toContain(CONTROLE_CAMPO);
    expect(html).toContain("font-mono");
    expect(html).toContain("tabular-nums");
    expect(html).toContain(">AS<");
    expect(html).toContain(">VL<");
    expect(html).toContain(CLASSES_TOM.sucesso);
    expect(html).toContain(CLASSES_TOM.perigo);
    expect(html).toContain("Pendente");
    expect(html).toContain("Aprovada");
    expect(html).toContain("Paga");
    expect(html).toContain("Estornada");
    expect(html).toContain("bg-surface-muted");
    expect(html).toContain("hover:bg-surface-muted");
    expect(html).toContain("Cálculo");
    expect(html).toContain('href="/matriculas/m1/preparacao"');
    expect(html).not.toContain("border-gray-300");
    expect(html).not.toContain("bg-green-100");
    expect(html).not.toContain("bg-amber-100");
    expect(html).not.toContain("bg-blue-100");
  });
});
