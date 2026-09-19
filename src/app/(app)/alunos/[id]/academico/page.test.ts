import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ sessao: vi.fn(), aluno: vi.fn(), contexto: vi.fn(), lista: vi.fn(), vinculos: vi.fn(), preferencia: vi.fn() }));
vi.mock("next/navigation", () => ({ notFound: vi.fn(() => { throw new Error("Não encontrado"); }) }));
vi.mock("@/server/_shared", () => ({
  exigirSessaoPagina: mocks.sessao,
  temPapel: (usuario: { papeis?: string[] }, ...papeis: string[]) => papeis.some((papel) => usuario.papeis?.includes(papel)),
}));
vi.mock("@/server/alunos/consultas", () => ({ obterAluno: mocks.aluno }));
vi.mock("@/lib/nome", () => ({ nomeCompleto: () => "Ana Aluna" }));
vi.mock("@/server/academico/consultas", () => ({ listarContextoMudancaAcademica: mocks.contexto, listarSolicitacoesAcademicas: mocks.lista }));
vi.mock("@/server/preferencias/fuso-exibicao", () => ({ consultarPreferenciaFusoEquipe: mocks.preferencia }));
vi.mock("@/lib/prisma", () => ({ prisma: { alocacaoTurma: { findMany: mocks.vinculos } } }));
vi.mock("@/app/(app)/academico/MudancasAcademicasPainel", () => ({
  MudancasAcademicasPainel: ({ fusoExibicao }: { fusoExibicao: string }) => createElement("p", { "data-testid": "painel" }, `fuso=${fusoExibicao}`),
}));

import Page from "./page";

const vinculos = [
  { id: "alocacao-a", matriculaId: "matricula-a", matricula: { codigo: "A-1" }, turma: { codigo: "TA", nome: null, nivel: { codigo: "A1", idioma: { nome: "Inglês" } } } },
  { id: "alocacao-b", matriculaId: "matricula-b", matricula: { codigo: "B-2" }, turma: { codigo: "TB", nome: null, nivel: { codigo: "B1", idioma: { nome: "Inglês" } } } },
];

const renderizar = (matriculaId = "matricula-b") => Page({
  params: Promise.resolve({ id: "aluno" }), searchParams: Promise.resolve({ matriculaId }),
});

describe("mudanças acadêmicas na ficha do aluno", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.sessao.mockResolvedValue({ id: "secretaria", papeis: ["SECRETARIA_ACADEMICA", "GERENTE_PEDAGOGICO"] });
    mocks.aluno.mockResolvedValue({ aluno: { id: "aluno" } });
    mocks.contexto.mockResolvedValue({ ok: true, dado: null });
    mocks.lista.mockResolvedValue({ ok: true, dado: { solicitacoes: [], proximo: "cursor" } });
    mocks.vinculos.mockResolvedValue(vinculos);
    mocks.preferencia.mockResolvedValue({ ok: true, dado: { fusoExibicao: "America/Costa_Rica" } });
  });

  it("mantém a matrícula selecionada e os links, passando a preferência somente ao painel", async () => {
    const html = renderToStaticMarkup(await renderizar());
    expect(html).toContain("fuso=America/Costa_Rica");
    expect(mocks.contexto).toHaveBeenCalledWith("aluno", "matricula-b");
    expect(mocks.lista).toHaveBeenCalledWith({ alunoId: "aluno", matriculaId: "matricula-b", antesDe: undefined });
    expect(html).toContain('href="/alunos/aluno/academico?matriculaId=matricula-a"');
    expect(html).toContain('href="/alunos/aluno/academico?matriculaId=matricula-b"');
    expect(html).toContain('href="/academico/avaliacoes/alocacao-b"');
    expect(html).toContain('href="/alunos/aluno/academico?antesDe=cursor&amp;matriculaId=matricula-b"');
  });

  it("usa São Paulo quando a preferência não estiver disponível", async () => {
    mocks.preferencia.mockResolvedValue({ ok: false, erro: "Indisponível" });
    const html = renderToStaticMarkup(await renderizar());
    expect(html).toContain("fuso=America/Sao_Paulo");
  });

  it("não lê aluno, contexto, solicitações, vínculos ou preferência quando a guarda falha", async () => {
    mocks.sessao.mockRejectedValue(new Error("Sem sessão"));
    await expect(renderizar()).rejects.toThrow("Sem sessão");
    expect(mocks.aluno).not.toHaveBeenCalled();
    expect(mocks.contexto).not.toHaveBeenCalled();
    expect(mocks.lista).not.toHaveBeenCalled();
    expect(mocks.vinculos).not.toHaveBeenCalled();
    expect(mocks.preferencia).not.toHaveBeenCalled();
  });
});
