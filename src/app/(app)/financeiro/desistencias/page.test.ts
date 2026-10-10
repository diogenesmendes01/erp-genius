import { renderToStaticMarkup } from "react-dom/server";
import { Papel } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ sessao: vi.fn(), listar: vi.fn() }));
vi.mock("@/server/_shared", () => ({ exigirSessaoPagina: mocks.sessao }));
vi.mock("@/server/matricula/desistencia-financeiro-consulta", () => ({ listarDesistenciasFinanceiras: mocks.listar }));

import Page from "./page";

const resposta = (sobrescrever: Record<string, unknown> = {}) => ({ ok: true, dado: {
  itens: [{ id: "matricula/a?", codigo: "MAT-596", pedido: { versao: 4, motivo: "Condições financeiras aguardam conferência" } }],
  temAnterior: false, temProxima: true, anterior: null, proxima: "m-ultima",
  ...sobrescrever,
} });

describe("FilaDesistenciasFinanceirasPage", () => {
  it("exige Financeiro/Administração e não expõe valores", async () => {
    mocks.sessao.mockResolvedValue({ papeis: [Papel.ADMINISTRADOR] });
    mocks.listar.mockResolvedValue(resposta());

    const html = renderToStaticMarkup(await Page({ searchParams: Promise.resolve({}) }));

    expect(mocks.sessao).toHaveBeenCalledWith(Papel.FINANCEIRO, Papel.ADMINISTRADOR);
    expect(mocks.listar).toHaveBeenCalledWith({});
    expect(html).toContain("MAT-596");
    expect(html).toContain("/matriculas/matricula%2Fa%3F/desistencia/financeiro");
    expect(html).not.toContain("CRC");
    expect(html).not.toContain("saldo");
  });

  it("fila por cursor nos dois sentidos: o início só tem Próxima; Anterior e Próxima levam o cursor certo", async () => {
    mocks.sessao.mockResolvedValue({ papeis: [Papel.FINANCEIRO] });
    mocks.listar.mockResolvedValue(resposta());
    const inicio = renderToStaticMarkup(await Page({ searchParams: Promise.resolve({}) }));
    expect(inicio).not.toContain("Anterior");
    expect(inicio).toContain('href="/financeiro/desistencias?depois=m-ultima">Próxima');
    expect(inicio).not.toContain("pagina=");

    mocks.listar.mockResolvedValue(resposta({ temAnterior: true, anterior: "m-primeira", proxima: "m-ultima" }));
    const meio = renderToStaticMarkup(await Page({ searchParams: Promise.resolve({ depois: "m-antes" }) }));
    expect(mocks.listar).toHaveBeenLastCalledWith({ depois: "m-antes" });
    expect(meio).toContain('href="/financeiro/desistencias?antes=m-primeira">← Anterior');
    expect(meio).toContain('href="/financeiro/desistencias?depois=m-ultima">Próxima');

    // Voltando (antes=…), o cursor chega intacto à consulta; sem próxima, só Anterior.
    mocks.listar.mockResolvedValue(resposta({ temAnterior: true, temProxima: false, anterior: "m-primeira", proxima: null }));
    const fim = renderToStaticMarkup(await Page({ searchParams: Promise.resolve({ antes: "m-depois" }) }));
    expect(mocks.listar).toHaveBeenLastCalledWith({ antes: "m-depois" });
    expect(fim).toContain("← Anterior");
    expect(fim).not.toContain("Próxima");
  });

  it("vazio: no início, fila zerada sem link para si; depois do fim, volta ao início", async () => {
    mocks.sessao.mockResolvedValue({ papeis: [Papel.FINANCEIRO] });
    mocks.listar.mockResolvedValue(resposta({ itens: [], temProxima: false, proxima: null }));

    const html = renderToStaticMarkup(await Page({ searchParams: Promise.resolve({}) }));
    expect(html).toContain("Nenhum pedido de desistência aguardando conferência financeira.");
    expect(html).not.toContain("nesta página");
    expect(html).not.toContain("Próxima");
    expect(html).not.toContain("Anterior");
    expect(html).not.toContain('href="/financeiro/desistencias"');

    const alem = renderToStaticMarkup(await Page({ searchParams: Promise.resolve({ depois: "m-sumida" }) }));
    expect(alem).toContain("Nenhum pedido a partir deste ponto da fila");
    expect(alem).toContain('href="/financeiro/desistencias">Ir para o início da fila');
    expect(alem).not.toContain("nesta página");
  });

  it("mostra somente erro quando a consulta falha (cursor inválido inclusive)", async () => {
    mocks.sessao.mockResolvedValue({ papeis: [Papel.FINANCEIRO] });
    mocks.listar.mockResolvedValue({ ok: false, erro: "Cursor de navegação inválido. Volte ao início da fila." });

    const html = renderToStaticMarkup(await Page({ searchParams: Promise.resolve({ depois: "x y" }) }));

    expect(html).toContain("Cursor de navegação inválido.");
    expect(html).not.toContain("Desistências para conferência financeira");
  });
});
