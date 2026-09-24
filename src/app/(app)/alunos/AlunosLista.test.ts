import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { StatusAluno } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn() }) }));
vi.mock("./ImportarAlunosModal", () => ({ ImportarAlunosModal: () => null }));

import { AlunosLista, type AlunoRow } from "./AlunosLista";
import { lerFiltrosAlunos } from "@/server/alunos/filtros";

const aluno = (i: number): AlunoRow => ({ id: `a${i}`, codigo: `A-${i}`, nome: `Aluno ${i}`, status: StatusAluno.ATIVO, pais: "Costa Rica", turmas: [], financeiro: null });
const opcoes = { paises: [{ id: "p1", nome: "Costa Rica" }], turmas: [{ id: "t1", label: "T-01 · Inglês · Inglês B1" }] };
const render = (props: Partial<Parameters<typeof AlunosLista>[0]>) =>
  renderToStaticMarkup(createElement(AlunosLista, { alunos: [], total: 0, totalBase: 0, filtros: lerFiltrosAlunos({}), opcoes, exibirFinanceiro: false, ...props }));

describe("AlunosLista (filtros na URL)", () => {
  it("formulário de busca com os filtros atuais preenchidos e opções do servidor (por id)", () => {
    const html = render({ alunos: [aluno(1)], total: 1, totalBase: 1, filtros: lerFiltrosAlunos({ busca: "ana", pais: "p1", turma: "t1" }) });
    expect(html).toMatch(/<form[^>]*action="\/alunos"/);
    expect(html).toContain('role="search"');
    expect(html).toContain('value="ana"');
    expect(html).toContain('<option value="p1" selected="">Costa Rica</option>');
    expect(html).toContain('<option value="t1" selected="">T-01 · Inglês · Inglês B1</option>');
    expect(html).toContain('href="/alunos"'); // limpar filtros
  });

  it("o formulário é recriado quando os filtros mudam (Limpar, voltar do navegador): chave = filtros sem página", () => {
    // Com defaultValue, o Next não remontaria os campos só por mudar a URL; a chave força a recriação.
    // Aqui: a chave muda com os filtros, não muda com a página, e os campos refletem os filtros novos.
    const comAna = render({ totalBase: 5, filtros: lerFiltrosAlunos({ busca: "ana", status: "ATIVO", pagina: "2" }) });
    expect(comAna).toContain('data-filtros="busca=ana&amp;status=ATIVO"');
    const limpo = render({ totalBase: 5, filtros: lerFiltrosAlunos({}) });
    expect(limpo).toContain('data-filtros=""');
    expect(limpo).not.toContain('value="ana"');
    expect(limpo).not.toContain('value="ATIVO" selected=""');
    const pausado = render({ totalBase: 5, filtros: lerFiltrosAlunos({ status: "PAUSADO" }) });
    expect(pausado).toContain('<option value="PAUSADO" selected="">');
    expect(pausado).toContain('data-filtros="status=PAUSADO"');
  });

  it("contador N de M distingue o recorte do total do escopo", () => {
    expect(render({ alunos: [aluno(1), aluno(2)], total: 2, totalBase: 40, filtros: lerFiltrosAlunos({ status: "ATIVO" }) }))
      .toContain("1–2 de 2 alunos encontrados (de 40 no total)");
    expect(render({ alunos: [aluno(1)], total: 1, totalBase: 1 })).toContain("1–1 de 1 aluno");
  });

  it("estado vazio: base vazia × filtro sem resultado × página vazia sem filtro", () => {
    expect(render({ totalBase: 0 })).toContain("Nenhum aluno cadastrado no seu alcance.");
    expect(render({ totalBase: 12, total: 0, filtros: lerFiltrosAlunos({ busca: "zzz" }) })).toContain("Nenhum aluno com esses filtros.");
    // Página além do fim sem filtro (a página redireciona; aqui é a salvaguarda): sem "401–400 de 120".
    const alem = render({ totalBase: 120, total: 120, filtros: lerFiltrosAlunos({ pagina: "9" }) });
    expect(alem).toContain("Nenhum aluno nesta página.");
    expect(alem).not.toContain("com esses filtros");
    expect(alem).not.toMatch(/\d+–\d+ de/);
  });

  it("paginação preserva os filtros nos links", () => {
    const html = render({ alunos: Array.from({ length: 50 }, (_, i) => aluno(i)), total: 120, totalBase: 120, filtros: lerFiltrosAlunos({ status: "ATIVO", pagina: "2" }) });
    expect(html).toContain('aria-label="Páginas de alunos"');
    expect(html).toContain('href="/alunos?status=ATIVO"'); // anterior → página 1
    expect(html).toContain('href="/alunos?status=ATIVO&amp;pagina=3"');
    expect(html).toContain("51–100 de 120 alunos");
  });

  it("tabela sinaliza carregamento por aria-busy (falso em repouso)", () => {
    expect(render({ totalBase: 1 })).toContain('aria-busy="false"');
  });

  it("coluna Financeiro segue a permissão, não os dados da página", () => {
    expect(render({ exibirFinanceiro: true })).toContain(">Financeiro<");
    expect(render({ exibirFinanceiro: false })).not.toContain(">Financeiro<");
  });
});
