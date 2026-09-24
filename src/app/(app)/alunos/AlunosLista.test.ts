import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { StatusAluno } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/form", () => ({ default: (props: Record<string, unknown>) => createElement("form", props) }));
vi.mock("./ImportarAlunosModal", () => ({ ImportarAlunosModal: () => null }));

import { AlunosLista, type AlunoRow } from "./AlunosLista";
import { lerFiltrosAlunos } from "@/server/alunos/filtros";

const aluno = (i: number): AlunoRow => ({ id: `a${i}`, codigo: `A-${i}`, nome: `Aluno ${i}`, status: StatusAluno.ATIVO, pais: "Costa Rica", turmas: [], financeiro: null });
const opcoes = { paises: [{ id: "p1", nome: "Costa Rica" }], turmas: [{ id: "t1", label: "Inglês B1" }] };
const render = (props: Partial<Parameters<typeof AlunosLista>[0]>) =>
  renderToStaticMarkup(createElement(AlunosLista, { alunos: [], total: 0, totalBase: 0, filtros: lerFiltrosAlunos({}), opcoes, exibirFinanceiro: false, ...props }));

describe("AlunosLista (filtros na URL)", () => {
  it("formulário GET com os filtros atuais preenchidos e opções vindas do servidor (por id)", () => {
    const html = render({ alunos: [aluno(1)], total: 1, totalBase: 1, filtros: lerFiltrosAlunos({ busca: "ana", pais: "p1", turma: "t1" }) });
    expect(html).toMatch(/<form[^>]*action="\/alunos"/);
    expect(html).toContain('name="busca"');
    expect(html).toContain('value="ana"');
    expect(html).toContain('<option value="p1" selected="">Costa Rica</option>');
    expect(html).toContain('<option value="t1" selected="">Inglês B1</option>');
    expect(html).toContain('href="/alunos"'); // limpar filtros
  });

  it("contador N de M distingue o recorte do total do escopo", () => {
    expect(render({ alunos: [aluno(1), aluno(2)], total: 2, totalBase: 40, filtros: lerFiltrosAlunos({ status: "ATIVO" }) }))
      .toContain("1–2 de 2 alunos encontrados (de 40 no total)");
    expect(render({ alunos: [aluno(1)], total: 1, totalBase: 1 })).toContain("1–1 de 1 aluno");
  });

  it("estado vazio duplo: base vazia × filtro sem resultado", () => {
    expect(render({ totalBase: 0 })).toContain("Nenhum aluno cadastrado no seu alcance.");
    expect(render({ totalBase: 12, filtros: lerFiltrosAlunos({ busca: "zzz" }) })).toContain("Nenhum aluno com esses filtros.");
  });

  it("paginação preserva os filtros nos links", () => {
    const html = render({ alunos: Array.from({ length: 50 }, (_, i) => aluno(i)), total: 120, totalBase: 120, filtros: lerFiltrosAlunos({ status: "ATIVO", pagina: "2" }) });
    expect(html).toContain('aria-label="Páginas de alunos"');
    expect(html).toContain('href="/alunos?status=ATIVO"'); // anterior → página 1
    expect(html).toContain('href="/alunos?status=ATIVO&amp;pagina=3"');
    expect(html).toContain("51–100 de 120 alunos");
  });

  it("coluna Financeiro segue a permissão, não os dados da página", () => {
    expect(render({ exibirFinanceiro: true })).toContain(">Financeiro<");
    expect(render({ exibirFinanceiro: false })).not.toContain(">Financeiro<");
  });
});
