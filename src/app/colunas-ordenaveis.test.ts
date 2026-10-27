import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { StatusAluno, StatusComissao } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn(), replace: vi.fn() }) }));
vi.mock("@/server/empresas/acoes", () => ({ salvarEmpresa: vi.fn() }));
vi.mock("@/app/(app)/alunos/ImportarAlunosModal", () => ({ ImportarAlunosModal: () => null }));
vi.mock("@/components/ColunaOrdenavel", async () => {
  const { createElement: h } = await import("react");
  return { ColunaOrdenavel: ({ campo, rotulo }: { campo: string; rotulo: string }) => h("th", { "data-coluna-ordenavel": campo }, rotulo) };
});

import { AlunosLista } from "./(app)/alunos/AlunosLista";
import { EmpresasCliente } from "./(app)/empresas/EmpresasCliente";
import { Comissoes } from "./(app)/financeiro/FinanceiroPainel";
import { lerFiltrosAlunos } from "@/server/alunos/filtros";
import { lerFiltrosEmpresas } from "@/server/empresas/filtros";
import { lerOrdemComissoes } from "@/server/financeiro/ordem-comissoes";

const colunas = (html: string) => (html.match(/data-coluna-ordenavel="[^"]+"/g) ?? []).map((m) => m.slice(23, -1));

describe("colunas ordenáveis (E1)", () => {
  it("/alunos: cabeçalhos ordenáveis vêm de <ColunaOrdenavel>, e nenhum aria-sort de outro lugar", () => {
    const html = renderToStaticMarkup(createElement(AlunosLista, {
      alunos: [{ id: "a1", codigo: "A-1", nome: "Ana", status: StatusAluno.ATIVO, pais: "Costa Rica", turmas: [], financeiro: null }],
      total: 1, totalBase: 1, filtros: lerFiltrosAlunos({}), opcoes: { paises: [], turmas: [] }, exibirFinanceiro: true,
    }));
    expect(colunas(html)).toEqual(["nome", "pais", "status"]);
    expect(html).not.toContain("aria-sort");
  });

  it("/empresas: cabeçalhos ordenáveis vêm de <ColunaOrdenavel>, e nenhum aria-sort de outro lugar", () => {
    const html = renderToStaticMarkup(createElement(EmpresasCliente, {
      empresas: [{ id: "e1", codigo: "E-1", nome: "Acme", pais: null, ativo: true, colaboradores: 2, faturasAReceber: 0 }],
      total: 1, totalBase: 1, filtros: lerFiltrosEmpresas({}), paises: [],
    }));
    expect(colunas(html)).toEqual(["codigo", "nome", "colaboradores", "situacao"]);
    expect(html).not.toContain("aria-sort");
  });

  it("/financeiro/comissoes: cabeçalhos ordenáveis vêm de <ColunaOrdenavel>, e nenhum aria-sort de outro lugar", () => {
    const html = renderToStaticMarkup(createElement(Comissoes, {
      comissoes: [{ id: "c1", vendedor: "Bia", valor: 10, moeda: "USD", percentual: 5, status: StatusComissao.PENDENTE }],
      aPagar: [], podePagar: false, onFechar: () => {}, fechamentoAutomatico: false, onToggleAutomatico: () => {}, isPending: false,
      ordenacao: { atual: lerOrdemComissoes({}), rota: "/financeiro/comissoes", parametros: {} },
    }));
    expect(colunas(html)).toEqual(["vendedor", "valor", "status"]);
    expect(html).not.toContain("aria-sort");
  });
});
