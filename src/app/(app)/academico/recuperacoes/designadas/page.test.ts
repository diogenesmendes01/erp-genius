import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ sessao: vi.fn(), listar: vi.fn() }));
vi.mock("@/server/_shared", () => ({ exigirSessaoPagina: mocks.sessao }));
vi.mock("@/server/avaliacoes/recuperacao-fila-docente", () => ({ listarTentativasRecuperacaoDesignadas: mocks.listar }));
vi.mock("../AgendaPublicada", () => ({ AgendaPublicada: () => null }));

import Designadas from "./page";

const semNavegacao = { temAnterior: false, temProxima: false, anterior: null, proxima: null };

// Revisão R1 da #134 (B5): início × ponto da fila sem itens nos dois modos; a volta preserva o modo.
describe("minhas recuperações — vazio da fila", () => {
  beforeEach(() => { vi.resetAllMocks(); mocks.sessao.mockResolvedValue({}); });
  const render = async (sp: Record<string, string>, modo: "pendentes" | "historico") => {
    mocks.listar.mockResolvedValue({ ok: true, dado: { modo, itens: [], ...semNavegacao } });
    return renderToStaticMarkup(await Designadas({ searchParams: Promise.resolve(sp) }));
  };

  it("início: diz que não há tentativa (pendentes) ou avaliação (histórico), sem 'nesta página' nem link para si", async () => {
    const pendentes = await render({}, "pendentes");
    expect(pendentes).toContain("Nenhuma tentativa pendente atribuída a você.");
    expect(pendentes).not.toContain("nesta página");
    const historico = await render({ modo: "historico" }, "historico");
    expect(historico).toContain("Nenhuma avaliação de recuperação no seu histórico.");
    expect(historico).not.toContain("Ir para o início da fila");
  });

  it("cursor que não leva a nada no histórico: a volta ao início continua no histórico", async () => {
    const html = await render({ modo: "historico", depois: "t-sumida" }, "historico");
    expect(html).toContain("Nenhuma tentativa a partir deste ponto da fila");
    expect(html).not.toContain("nesta página");
    expect(html).toContain('<a class="underline" href="?modo=historico">Ir para o início da fila</a>');
  });
});

describe("minhas recuperações — cursor nos dois sentidos (E4, fila)", () => {
  beforeEach(() => { vi.resetAllMocks(); mocks.sessao.mockResolvedValue({}); });
  const item = { id: "t/1", habilidade: "FALA", aluno: "Ana", matriculaCodigo: "M-1", matriculaId: "m", turma: "T-1", nivel: "A1", realizada: false, realizacaoId: null, agenda: null };
  const render = async (sp: Record<string, string>, dado: Record<string, unknown>) => {
    mocks.listar.mockResolvedValue({ ok: true, dado: { modo: "pendentes", itens: [item], temAnterior: false, temProxima: true, anterior: null, proxima: "t-20", ...dado } });
    return renderToStaticMarkup(await Designadas({ searchParams: Promise.resolve(sp) }));
  };

  it("início: só Próxima, mantendo o modo e sem link para si mesmo", async () => {
    const html = await render({}, {});
    expect(mocks.listar).toHaveBeenCalledWith({ modo: "pendentes" });
    expect(html).not.toContain("Anterior");
    expect(html).not.toContain("pagina");
    expect(html).toContain('href="/academico/recuperacoes/designadas?modo=pendentes&amp;depois=t-20">Próxima');
  });

  it("no meio do histórico, os dois sentidos com o cursor certo; a última não tem Próxima", async () => {
    const meio = await render({ modo: "historico", depois: "t-20" }, { modo: "historico", temAnterior: true, anterior: "t-21", proxima: "t-40" });
    expect(mocks.listar).toHaveBeenCalledWith({ depois: "t-20", modo: "historico" });
    expect(meio).toContain('href="/academico/recuperacoes/designadas?modo=historico&amp;antes=t-21">← Anterior');
    expect(meio).toContain('href="/academico/recuperacoes/designadas?modo=historico&amp;depois=t-40">Próxima');
    const ultima = await render({ antes: "t-60" }, { temAnterior: true, temProxima: false, anterior: "t-41", proxima: null });
    expect(mocks.listar).toHaveBeenLastCalledWith({ antes: "t-60", modo: "pendentes" });
    expect(ultima).toContain('href="/academico/recuperacoes/designadas?modo=pendentes&amp;antes=t-41">← Anterior');
    expect(ultima).not.toContain("Próxima");
  });
});
