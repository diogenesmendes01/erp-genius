import { renderToStaticMarkup } from "react-dom/server";
import { Papel } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ sessao: vi.fn(), listar: vi.fn() }));
vi.mock("@/server/_shared", () => ({ exigirSessaoPagina: mocks.sessao }));
vi.mock("@/server/matricula/desistencia-financeiro-consulta", () => ({ listarDesistenciasFinanceiras: mocks.listar }));

import Page from "./page";

const resposta = (sobrescrever: Record<string, unknown> = {}) => ({ ok: true, dado: {
  itens: [{ id: "matricula/a?", codigo: "MAT-596", pedido: { versao: 4, motivo: "Condições financeiras aguardam conferência" } }],
  pagina: 1,
  temProxima: true,
  ...sobrescrever,
} });

describe("FilaDesistenciasFinanceirasPage", () => {
  it("exige Financeiro/Administração e não expõe valores", async () => {
    mocks.sessao.mockResolvedValue({ papeis: [Papel.ADMINISTRADOR] });
    mocks.listar.mockResolvedValue(resposta());

    const html = renderToStaticMarkup(await Page({ searchParams: Promise.resolve({}) }));

    expect(mocks.sessao).toHaveBeenCalledWith(Papel.FINANCEIRO, Papel.ADMINISTRADOR);
    expect(mocks.listar).toHaveBeenCalledWith({ pagina: 1 });
    expect(html).toContain("MAT-596");
    expect(html).toContain("/matriculas/matricula%2Fa%3F/desistencia/financeiro");
    expect(html).not.toContain("CRC");
    expect(html).not.toContain("saldo");
  });

  it("paginação nos dois sentidos: a primeira página só tem Próxima; no meio, as duas; Anterior volta à página certa", async () => {
    mocks.sessao.mockResolvedValue({ papeis: [Papel.FINANCEIRO] });
    mocks.listar.mockResolvedValue(resposta());
    const primeira = renderToStaticMarkup(await Page({ searchParams: Promise.resolve({}) }));
    expect(primeira).not.toContain("Anterior");
    expect(primeira).toContain('href="/financeiro/desistencias?pagina=2"');
    expect(primeira).toContain("Próxima");

    mocks.listar.mockResolvedValue(resposta({ pagina: 3 }));
    const meio = renderToStaticMarkup(await Page({ searchParams: Promise.resolve({ pagina: "3" }) }));
    expect(mocks.listar).toHaveBeenLastCalledWith({ pagina: 3 });
    expect(meio).toContain('href="/financeiro/desistencias?pagina=2">← Anterior');
    expect(meio).toContain('href="/financeiro/desistencias?pagina=4">Próxima');

    // Da segunda página, Anterior volta à primeira sem ?pagina=1.
    mocks.listar.mockResolvedValue(resposta({ pagina: 2, temProxima: false }));
    const segunda = renderToStaticMarkup(await Page({ searchParams: Promise.resolve({ pagina: "2" }) }));
    expect(segunda).toContain('href="/financeiro/desistencias">← Anterior');
    expect(segunda).not.toContain("Próxima");
  });

  it("declara explicitamente uma página vazia", async () => {
    mocks.sessao.mockResolvedValue({ papeis: [Papel.FINANCEIRO] });
    mocks.listar.mockResolvedValue(resposta({ itens: [], temProxima: false }));

    const html = renderToStaticMarkup(await Page({ searchParams: Promise.resolve({}) }));

    // Primeira página: fila zerada, não "nesta página" (docs/42), e sem navegação.
    expect(html).toContain("Nenhum pedido de desistência aguardando conferência financeira.");
    expect(html).not.toContain("nesta página");
    expect(html).not.toContain("Próxima");
    expect(html).not.toContain("Anterior");

    const seguinte = renderToStaticMarkup(await Page({ searchParams: Promise.resolve({ pagina: "2" }) }));
    expect(seguinte).toContain("Nenhum pedido nesta página.");
    expect(seguinte).toContain('href="/financeiro/desistencias">← Anterior');
  });

  it("mostra somente erro quando a consulta falha", async () => {
    mocks.sessao.mockResolvedValue({ papeis: [Papel.FINANCEIRO] });
    mocks.listar.mockResolvedValue({ ok: false, erro: "Consulta indisponível agora." });

    const html = renderToStaticMarkup(await Page({ searchParams: Promise.resolve({}) }));

    expect(html).toContain("Consulta indisponível agora.");
    expect(html).not.toContain("Desistências para conferência financeira");
  });
});
