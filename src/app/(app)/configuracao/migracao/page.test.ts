import { renderToStaticMarkup } from "react-dom/server";
import { Papel } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ sessao: vi.fn(), consultar: vi.fn() }));
vi.mock("@/server/_shared", () => ({ exigirSessaoPagina: mocks.sessao }));
vi.mock("@/server/migracao/consultas", () => ({ consultarLotesPreparacaoMigracao: mocks.consultar }));
vi.mock("./PreparacaoMigracaoPainel", () => ({ PreparacaoMigracaoPainel: () => null }));

import Page from "./page";

const lote = { id: "lote/1", origem: "Q10", chaveLote: "alunos-2026", estado: "PREPARADO", criadoEm: new Date("2026-09-01T12:00:00Z"), preparadoPorNome: "Admin", linhas: 3, pendencias: 0, colisoes: 0, conflitosEntrada: 0 };
const render = async (params: Record<string, string>) => renderToStaticMarkup(await Page({ searchParams: Promise.resolve(params) }));

describe("/configuracao/migracao — lotes preparados nos dois sentidos (E4)", () => {
  beforeEach(() => { vi.resetAllMocks(); mocks.sessao.mockResolvedValue({ papeis: [Papel.ADMINISTRADOR] }); });

  it("primeira página: só Próxima, sem link para si mesma", async () => {
    mocks.consultar.mockResolvedValue({ ok: true, dado: { itens: [lote], pagina: 1, temProxima: true } });
    const html = await render({});
    expect(mocks.sessao).toHaveBeenCalledWith(Papel.ADMINISTRADOR);
    expect(mocks.consultar).toHaveBeenCalledWith({ pagina: 1 });
    expect(html).toContain("/configuracao/migracao/lote%2F1");
    expect(html).not.toContain("Anterior");
    expect(html).not.toContain("pagina=1");
    expect(html).toContain('href="/configuracao/migracao?pagina=2">Próxima');
  });

  it("no meio: Anterior e Próxima, cada uma na página certa", async () => {
    mocks.consultar.mockResolvedValue({ ok: true, dado: { itens: [lote], pagina: 3, temProxima: true } });
    const html = await render({ pagina: "3" });
    expect(mocks.consultar).toHaveBeenCalledWith({ pagina: 3 });
    expect(html).toContain('href="/configuracao/migracao?pagina=2">← Anterior');
    expect(html).toContain('href="/configuracao/migracao?pagina=4">Próxima');
  });

  it("última página: Anterior para a primeira sem ?pagina=1 e sem Próxima; uma página só não tem navegação", async () => {
    mocks.consultar.mockResolvedValue({ ok: true, dado: { itens: [lote], pagina: 2, temProxima: false } });
    const ultima = await render({ pagina: "2" });
    expect(ultima).toContain('href="/configuracao/migracao">← Anterior');
    expect(ultima).not.toContain("Próxima");
    mocks.consultar.mockResolvedValue({ ok: true, dado: { itens: [lote], pagina: 1, temProxima: false } });
    const unica = await render({});
    expect(unica).not.toContain("Anterior");
    expect(unica).not.toContain("Próxima");
  });

  it("falha na consulta: o erro, sem navegação inventada", async () => {
    mocks.consultar.mockResolvedValue({ ok: false, erro: "Sem acesso." });
    const html = await render({});
    expect(html).toContain("Não foi possível consultar os lotes: Sem acesso.");
    expect(html).not.toContain("Próxima");
  });
});
