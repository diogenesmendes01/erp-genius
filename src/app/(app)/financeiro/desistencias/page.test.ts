import { renderToStaticMarkup } from "react-dom/server";
import { Papel } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ sessao: vi.fn(), listar: vi.fn() }));
vi.mock("@/server/_shared", () => ({ exigirSessaoPagina: mocks.sessao }));
vi.mock("@/server/matricula/desistencia-financeiro-consulta", () => ({ listarDesistenciasFinanceiras: mocks.listar }));

import Page from "./page";

const resposta = (sobrescrever: Record<string, unknown> = {}) => ({ ok: true, dado: {
  itens: [{ id: "matricula/a?", codigo: "MAT-596", pedido: { versao: 4, motivo: "Condições financeiras aguardam conferência" } }],
  proximoCursor: "cursor &/",
  ...sobrescrever,
} });

describe("FilaDesistenciasFinanceirasPage", () => {
  it("exige Financeiro/Administração e codifica o cursor sem expor valores", async () => {
    mocks.sessao.mockResolvedValue({ papeis: [Papel.ADMINISTRADOR] });
    mocks.listar.mockResolvedValue(resposta());

    const html = renderToStaticMarkup(await Page({ searchParams: Promise.resolve({ cursor: "anterior" }) }));

    expect(mocks.sessao).toHaveBeenCalledWith(Papel.FINANCEIRO, Papel.ADMINISTRADOR);
    expect(mocks.listar).toHaveBeenCalledWith({ cursor: "anterior" });
    expect(html).toContain("MAT-596");
    expect(html).toContain("/matriculas/matricula%2Fa%3F/desistencia/financeiro");
    expect(html).toContain("cursor=cursor%20%26%2F");
    expect(html).toContain("Voltar ao início");
    expect(html).not.toContain("CRC");
    expect(html).not.toContain("saldo");
  });

  it("declara explicitamente uma página vazia", async () => {
    mocks.sessao.mockResolvedValue({ papeis: [Papel.FINANCEIRO] });
    mocks.listar.mockResolvedValue(resposta({ itens: [], proximoCursor: null }));

    const html = renderToStaticMarkup(await Page({ searchParams: Promise.resolve({}) }));

    expect(html).toContain("Nenhum pedido nesta página.");
    expect(html).not.toContain("Próxima página");
    expect(html).not.toContain("Voltar ao início");
  });

  it("mostra somente erro quando a consulta falha", async () => {
    mocks.sessao.mockResolvedValue({ papeis: [Papel.FINANCEIRO] });
    mocks.listar.mockResolvedValue({ ok: false, erro: "Cursor de fila inválido." });

    const html = renderToStaticMarkup(await Page({ searchParams: Promise.resolve({}) }));

    expect(html).toContain("Cursor de fila inválido.");
    expect(html).not.toContain("Desistências para conferência financeira");
  });
});
