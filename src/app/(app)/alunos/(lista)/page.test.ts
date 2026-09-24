import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  papeis: vi.fn(async () => ["SECRETARIA_ACADEMICA"] as string[] | null),
  sessao: vi.fn(async () => ({ id: "u1", nome: "U", papeis: ["SECRETARIA_ACADEMICA"] })),
  opcoes: vi.fn(async () => ({ paises: [{ id: "p1", nome: "Costa Rica" }], turmas: [{ id: "t1", label: "T-01 · Inglês B1" }] })),
  pagina: vi.fn(async () => ({ itens: [] as unknown[], total: 120, totalBase: 400 })),
  redirect: vi.fn((destino: string) => { throw new Error(`REDIRECT ${destino}`); }),
  exportar: vi.fn((props: { query?: string }) => createElement("a", { "data-query": props.query ?? "" })),
  lista: vi.fn((props: Record<string, unknown>) => createElement("div", { "data-lista": JSON.stringify(props.filtros) })),
}));
vi.mock("@/lib/guards", () => ({ exigirPapelLeitura: mocks.papeis }));
vi.mock("@/server/_shared", () => ({ exigirSessao: mocks.sessao }));
vi.mock("@/server/alunos/consultas", () => ({ opcoesFiltroAlunos: mocks.opcoes, listarAlunosPagina: mocks.pagina, podeVerFinanceiroAluno: () => true }));
vi.mock("@/server/matricula/permissoes", () => ({ podeCriarMatricula: () => false }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("@/components/ExportarPlanilha", () => ({ ExportarPlanilha: mocks.exportar }));
vi.mock("@/components/AcessoNegado", () => ({ AcessoNegado: () => createElement("p", null, "Acesso negado") }));
vi.mock("../AlunosLista", () => ({ AlunosLista: mocks.lista }));

import AlunosPage from "./page";

const pagina = async (params: Record<string, string>) => renderToStaticMarkup(await AlunosPage({ searchParams: Promise.resolve(params) }));

describe("/alunos (página)", () => {
  beforeEach(() => { Object.values(mocks).forEach((m) => m.mockClear()); });

  it("página além do fim redireciona para a última, preservando os filtros", async () => {
    await expect(pagina({ status: "ATIVO", pagina: "9" })).rejects.toThrow("REDIRECT /alunos?status=ATIVO&pagina=3");
  });

  it("página válida não redireciona", async () => {
    await pagina({ pagina: "2" });
    expect(mocks.redirect).not.toHaveBeenCalled();
  });

  it("país/turma fora das opções são descartados antes da consulta (select e lista coerentes)", async () => {
    await pagina({ pais: "p-antigo", turma: "t1" });
    expect(mocks.pagina).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ paisId: null, turmaId: "t1" }));
  });

  it("o botão de exportar leva os filtros aplicados (sem a página)", async () => {
    await pagina({ status: "ATIVO", busca: "ana", pagina: "2" });
    expect(mocks.exportar.mock.calls[0][0]).toMatchObject({ tipo: "alunos", query: "busca=ana&status=ATIVO" });
  });

  it("sem papel de alunos: acesso negado, sem consultar", async () => {
    mocks.papeis.mockResolvedValueOnce(null);
    expect(await pagina({})).toContain("Acesso negado");
    expect(mocks.pagina).not.toHaveBeenCalled();
  });
});
