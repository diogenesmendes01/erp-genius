import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ sessao: vi.fn(), listar: vi.fn() }));
vi.mock("@/server/_shared", () => ({ exigirSessaoPagina: mocks.sessao }));
vi.mock("@/server/avaliacoes/recuperacao-fila-docente", () => ({ listarTentativasRecuperacaoDesignadas: mocks.listar }));
vi.mock("../AgendaPublicada", () => ({ AgendaPublicada: () => null }));

import Designadas from "./page";

// Revisão R1 da #134 (B5): página 1 × página seguinte nos dois modos; a volta preserva o modo.
describe("minhas recuperações — vazio paginado", () => {
  beforeEach(() => { vi.resetAllMocks(); mocks.sessao.mockResolvedValue({}); });
  const render = async (sp: Record<string, string>, modo: "pendentes" | "historico") => {
    mocks.listar.mockResolvedValue({ ok: true, dado: { modo, itens: [], pagina: Number(sp.pagina ?? 1), temProxima: false } });
    return renderToStaticMarkup(await Designadas({ searchParams: Promise.resolve(sp) }));
  };

  it("página 1: diz que não há tentativa (pendentes) ou avaliação (histórico), sem 'nesta página'", async () => {
    const pendentes = await render({}, "pendentes");
    expect(pendentes).toContain("Nenhuma tentativa pendente atribuída a você.");
    expect(pendentes).not.toContain("nesta página");
    const historico = await render({ modo: "historico" }, "historico");
    expect(historico).toContain("Nenhuma avaliação de recuperação no seu histórico.");
    expect(historico).not.toContain("Ir para a primeira página");
  });

  it("página seguinte do histórico: a volta ao início continua no histórico", async () => {
    const html = await render({ modo: "historico", pagina: "2" }, "historico");
    expect(html).toContain("Nenhuma tentativa disponível nesta página.");
    expect(html).toContain('<a class="underline" href="?modo=historico">Ir para a primeira página</a>');
    expect(html).toContain('href="/academico/recuperacoes/designadas?modo=historico">← Anterior');
  });
});

describe("minhas recuperações — paginação nos dois sentidos (E4)", () => {
  beforeEach(() => { vi.resetAllMocks(); mocks.sessao.mockResolvedValue({}); });
  const item = { id: "t/1", habilidade: "FALA", aluno: "Ana", matriculaCodigo: "M-1", matriculaId: "m", turma: "T-1", nivel: "A1", realizada: false, realizacaoId: null, agenda: null };
  const render = async (sp: Record<string, string>, dado: Record<string, unknown>) => {
    mocks.listar.mockResolvedValue({ ok: true, dado: { modo: "pendentes", itens: [item], pagina: 1, temProxima: true, ...dado } });
    return renderToStaticMarkup(await Designadas({ searchParams: Promise.resolve(sp) }));
  };

  it("primeira página: só Próxima, mantendo o modo e sem link para si mesma", async () => {
    const html = await render({}, {});
    expect(mocks.listar).toHaveBeenCalledWith({ pagina: 1, modo: "pendentes" });
    expect(html).not.toContain("Anterior");
    expect(html).not.toContain("pagina=1");
    expect(html).toContain('href="/academico/recuperacoes/designadas?modo=pendentes&amp;pagina=2">Próxima');
  });

  it("no meio do histórico, os dois sentidos; da segunda, Anterior volta sem ?pagina=1 e a última não tem Próxima", async () => {
    const meio = await render({ modo: "historico", pagina: "3" }, { modo: "historico", pagina: 3 });
    expect(mocks.listar).toHaveBeenCalledWith({ pagina: 3, modo: "historico" });
    expect(meio).toContain('href="/academico/recuperacoes/designadas?modo=historico&amp;pagina=2">← Anterior');
    expect(meio).toContain('href="/academico/recuperacoes/designadas?modo=historico&amp;pagina=4">Próxima');
    const ultima = await render({ pagina: "2" }, { pagina: 2, temProxima: false });
    expect(ultima).toContain('href="/academico/recuperacoes/designadas?modo=pendentes">← Anterior');
    expect(ultima).not.toContain("Próxima");
  });
});
