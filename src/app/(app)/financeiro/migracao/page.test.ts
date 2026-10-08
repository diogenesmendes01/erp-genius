import { renderToStaticMarkup } from "react-dom/server";
import { Papel } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ sessao: vi.fn(), listar: vi.fn() }));
vi.mock("@/server/_shared", () => ({ exigirSessaoPagina: mocks.sessao }));
vi.mock("@/server/migracao/consultas-financeiras", () => ({ listarLinhasConciliacaoFinanceira: mocks.listar }));

import Page from "./page";

const linha = { id: "linha/1", linhaOrigem: "financeiro!2", matriculaOrigemId: "M-9", financeiroOrigemId: "F-9", estado: "PRONTA_PARA_REVISAO", lote: { origem: "Q10", chaveLote: "lote" }, propostasConciliacaoFinanceira: [] };
const render = async (params: Record<string, string>) => renderToStaticMarkup(await Page({ searchParams: Promise.resolve(params) }));

describe("/financeiro/migracao — fila de conciliação nos dois sentidos (E4)", () => {
  beforeEach(() => { vi.resetAllMocks(); mocks.sessao.mockResolvedValue({ papeis: [Papel.FINANCEIRO] }); });

  it("primeira página: só Próxima, sem link para si mesma", async () => {
    mocks.listar.mockResolvedValue({ ok: true, dado: { itens: [linha], pagina: 1, temProxima: true } });
    const html = await render({});
    expect(mocks.sessao).toHaveBeenCalledWith(Papel.ADMINISTRADOR, Papel.FINANCEIRO);
    expect(mocks.listar).toHaveBeenCalledWith({ pagina: 1 });
    expect(html).toContain("/financeiro/migracao/linha%2F1");
    expect(html).not.toContain("Anterior");
    expect(html).not.toContain("pagina=1");
    expect(html).toContain('href="/financeiro/migracao?pagina=2">Próxima');
  });

  it("no meio, os dois sentidos; da segunda, Anterior volta à primeira sem ?pagina=1", async () => {
    mocks.listar.mockResolvedValue({ ok: true, dado: { itens: [linha], pagina: 4, temProxima: true } });
    const meio = await render({ pagina: "4" });
    expect(mocks.listar).toHaveBeenCalledWith({ pagina: 4 });
    expect(meio).toContain('href="/financeiro/migracao?pagina=3">← Anterior');
    expect(meio).toContain('href="/financeiro/migracao?pagina=5">Próxima');
    mocks.listar.mockResolvedValue({ ok: true, dado: { itens: [linha], pagina: 2, temProxima: false } });
    const segunda = await render({ pagina: "2" });
    expect(segunda).toContain('href="/financeiro/migracao">← Anterior');
    expect(segunda).not.toContain("Próxima");
  });

  it("vazio: fila zerada na primeira página; 'nesta página' só depois dela, com a volta", async () => {
    mocks.listar.mockResolvedValue({ ok: true, dado: { itens: [], pagina: 1, temProxima: false } });
    const zerada = await render({});
    expect(zerada).toContain("Nenhuma linha financeira da migração para conciliar.");
    expect(zerada).not.toContain("nesta página");
    expect(zerada).not.toContain("Anterior");
    const alem = await render({ pagina: "3" });
    expect(alem).toContain("Nenhuma linha financeira nesta página.");
    expect(alem).toContain('href="/financeiro/migracao?pagina=2">← Anterior');
  });
});
