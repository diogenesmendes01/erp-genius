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
    mocks.listar.mockResolvedValue({ ok: true, dado: { modo, itens: [], proximoId: null } });
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
    const html = await render({ modo: "historico", depoisId: "t9" }, "historico");
    expect(html).toContain("Nenhuma tentativa disponível nesta página.");
    expect(html).toContain('<a class="underline" href="?modo=historico">Ir para a primeira página</a>');
  });
});
