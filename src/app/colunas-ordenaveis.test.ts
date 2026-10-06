import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { StatusAluno, StatusComissao } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";

// E1 / §5.6 A9 (docs/42-auditoria-frontend-ux.md): "0 colunas ordenáveis"; meta "≥ 3 (/comissoes,
// /alunos, /empresas)". Trava: (1) as tabelas dessas telas têm cabeçalhos ordenáveis, renderizados com
// aria-sort; (2) aria-sort só nasce de <ColunaOrdenavel> — um <th aria-sort> à mão costuma marcar a
// ordem sem ordenar no servidor (ou ordenar só a página exibida), o que mente para quem usa leitor de tela.

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn(), replace: vi.fn() }) }));
vi.mock("@/server/empresas/acoes", () => ({ salvarEmpresa: vi.fn() }));
vi.mock("@/app/(app)/alunos/ImportarAlunosModal", () => ({ ImportarAlunosModal: () => null }));

import { AlunosLista } from "./(app)/alunos/AlunosLista";
import { EmpresasCliente } from "./(app)/empresas/EmpresasCliente";
import { Comissoes } from "./(app)/financeiro/FinanceiroPainel";
import { lerFiltrosAlunos } from "@/server/alunos/filtros";
import { lerFiltrosEmpresas } from "@/server/empresas/filtros";
import { lerOrdemComissoes } from "@/server/financeiro/ordem-comissoes";

const COMPONENTE = "src/components/ColunaOrdenavel.tsx";

/** Código de produção (sem testes) de src/app e src/components. */
const fontes = ["src/app", "src/components"].flatMap((raiz) =>
  (readdirSync(raiz, { recursive: true }) as string[])
    .filter((f) => /\.tsx?$/.test(f) && !/\.test\.tsx?$/.test(f))
    .map((f) => ({ arquivo: join(raiz, f).split("\\").join("/"), conteudo: readFileSync(join(raiz, f), "utf-8") })),
);

/** As telas da meta e o arquivo que monta cada tabela. */
const TELAS = [
  "src/app/(app)/alunos/AlunosLista.tsx",
  "src/app/(app)/empresas/EmpresasCliente.tsx",
  "src/app/(app)/financeiro/FinanceiroPainel.tsx",
  "src/app/(app)/comissoes/page.tsx",
];

const ARIA_SORT = /aria-sort|ariaSort/;
const contar = (html: string) => (html.match(/aria-sort="(?:ascending|descending|none)"/g) ?? []).length;
const soNoCabecalho = (html: string) => (html.match(/<[a-z]+ [^>]*aria-sort=/g) ?? []).every((t) => t.startsWith('<th scope="col" aria-sort='));

describe("colunas ordenáveis (E1)", () => {
  it("aria-sort só é escrito por <ColunaOrdenavel> — nenhum <th> do app o põe à mão", () => {
    const ofensores = fontes.filter(({ arquivo, conteudo }) => arquivo !== COMPONENTE && ARIA_SORT.test(conteudo)).map((f) => f.arquivo);
    expect(ofensores).toEqual([]);
    expect(fontes.find((f) => f.arquivo === COMPONENTE)?.conteudo).toMatch(/aria-sort=/);
  });

  it("as tabelas de /alunos, /empresas e /comissoes (as duas telas) usam <ColunaOrdenavel>", () => {
    const sem = TELAS.filter((t) => !/<ColunaOrdenavel\b/.test(fontes.find((f) => f.arquivo === t)?.conteudo ?? ""));
    expect(sem).toEqual([]);
  });

  it("/alunos: cabeçalhos ordenáveis renderizados (aria-sort no <th>)", () => {
    const html = renderToStaticMarkup(createElement(AlunosLista, {
      alunos: [{ id: "a1", codigo: "A-1", nome: "Ana", status: StatusAluno.ATIVO, pais: "Costa Rica", turmas: [], financeiro: null }],
      total: 1, totalBase: 1, filtros: lerFiltrosAlunos({}), opcoes: { paises: [], turmas: [] }, exibirFinanceiro: true,
    }));
    expect(contar(html)).toBeGreaterThanOrEqual(1);
    expect(soNoCabecalho(html)).toBe(true);
  });

  it("/empresas: cabeçalhos ordenáveis renderizados (aria-sort no <th>)", () => {
    const html = renderToStaticMarkup(createElement(EmpresasCliente, {
      empresas: [{ id: "e1", codigo: "E-1", nome: "Acme", pais: null, ativo: true, colaboradores: 2, faturasAReceber: 0 }],
      total: 1, totalBase: 1, filtros: lerFiltrosEmpresas({}), paises: [],
    }));
    expect(contar(html)).toBeGreaterThanOrEqual(1);
    expect(soNoCabecalho(html)).toBe(true);
  });

  it("/financeiro/comissoes: cabeçalhos ordenáveis renderizados (aria-sort no <th>)", () => {
    const html = renderToStaticMarkup(createElement(Comissoes, {
      comissoes: [{ id: "c1", vendedor: "Bia", valor: 10, moeda: "USD", percentual: 5, status: StatusComissao.PENDENTE }],
      aPagar: [], podePagar: false, onFechar: () => {}, fechamentoAutomatico: false, onToggleAutomatico: () => {}, isPending: false,
      ordenacao: { atual: lerOrdemComissoes({}), rota: "/financeiro/comissoes", parametros: {} },
    }));
    expect(contar(html)).toBeGreaterThanOrEqual(1);
    expect(soNoCabecalho(html)).toBe(true);
  });
});
