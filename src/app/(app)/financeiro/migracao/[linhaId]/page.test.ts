import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  chamadas: [] as string[],
  guarda: vi.fn(),
  preferencia: vi.fn(),
  consulta: vi.fn(),
  conferencia: vi.fn(),
}));

vi.mock("@/server/_shared", () => ({ exigirSessaoPagina: mocks.guarda }));
vi.mock("@/server/preferencias/fuso-exibicao", () => ({ consultarPreferenciaFusoEquipe: mocks.preferencia }));
vi.mock("@/server/migracao/consultas-financeiras", () => ({ consultarConciliacaoFinanceiraMigracao: mocks.consulta }));
vi.mock("./ConferenciaFinanceiraMigracao", () => ({ ConferenciaFinanceiraMigracao: ({ preferenciaFusoExibicao }: { preferenciaFusoExibicao: string | null }) => { mocks.conferencia(preferenciaFusoExibicao); return createElement("p", null, `formulário financeiro em ${preferenciaFusoExibicao ?? "UTC"}`); } }));
vi.mock("@/server/migracao/entrada-financeira-historica", () => ({
  consultarEntradasFinanceirasHistoricasMigracao: vi.fn().mockResolvedValue({ ok: true, dado: [] }),
  listarPaisesEntradaFinanceiraHistoricaMigracao: vi.fn().mockResolvedValue({ ok: true, dado: [] }),
}));
vi.mock("./EntradaFinanceiraHistorica", () => ({ EntradaFinanceiraHistorica: ({ linhaId }: { linhaId: string }) => createElement("p", null, `entrada histórica da linha ${linhaId}`) }));

import Pagina from "./page";

const dado = {
  linha: { id: "l", linhaOrigem: "financeiro!2", entradaHash: "h", dadosOrigem: { financeiro: { valor: "10" } }, lote: { origem: "LEGADO", chaveLote: "lote" }, mapa: { matriculaId: "m", codigo: "M-1", status: "ATIVA", aluno: "Ana" } },
  cobrancas: [], recebimentos: [], pagadores: [], propostas: [], podeDecidir: true,
  pagina: 1, paginaRecebimentos: 1, paginaPagadores: 1, paginaPropostas: 1,
  temProxima: false, temProximaRecebimentos: false, temProximaPagadores: false, temProximaPropostas: false,
};

describe("rota de conciliação financeira", () => {
  beforeEach(() => {
    mocks.chamadas.length = 0;
    mocks.guarda.mockReset().mockImplementation(async () => { mocks.chamadas.push("guarda"); });
    mocks.preferencia.mockReset().mockImplementation(async () => { mocks.chamadas.push("preferencia"); return { ok: true, dado: { fusoExibicao: "America/Adak" } }; });
    mocks.consulta.mockReset().mockResolvedValue({ ok: true, dado });
    mocks.conferencia.mockReset();
  });

  it("lê a preferência depois da guarda e a encaminha ao histórico financeiro", async () => {
    const html = renderToStaticMarkup(await Pagina({ params: Promise.resolve({ linhaId: "l" }), searchParams: Promise.resolve({}) }));
    expect(html).toContain('aria-label="Voltar para Financeiro"');
    expect(html).toContain("formulário financeiro em America/Adak");
    expect(html).toContain("entrada histórica da linha l");
    expect(mocks.chamadas).toEqual(["guarda", "preferencia"]);
    expect(mocks.conferencia).toHaveBeenCalledWith("America/Adak");
  });

  it("cada coleção pagina nos dois sentidos e o link de uma mantém a página das outras", async () => {
    const render = async (busca: Record<string, string>) => renderToStaticMarkup(await Pagina({ params: Promise.resolve({ linhaId: "l/1" }), searchParams: Promise.resolve(busca) }));
    // Primeira página de tudo: só "Próxima" nas coleções com mais registros, e nenhum link para a página 1.
    mocks.consulta.mockResolvedValue({ ok: true, dado: { ...dado, temProxima: true, temProximaPropostas: true } });
    const primeira = await render({});
    expect(mocks.consulta).toHaveBeenLastCalledWith({ linhaId: "l/1", pagina: 1, paginaRecebimentos: 1, paginaPagadores: 1, paginaPropostas: 1 });
    expect(primeira).not.toContain("Anterior");
    expect(primeira).not.toMatch(/pagina\w*=1(?!\d)/);
    expect(primeira).toContain('href="/financeiro/migracao/l%2F1?pagina=2">Próxima');
    expect(primeira).toContain('href="/financeiro/migracao/l%2F1?paginaPropostas=2">Próxima');

    // Cobranças na 3ª e recebimentos na 2ª: os dois sentidos em cada uma, sem perder a outra.
    mocks.consulta.mockResolvedValue({ ok: true, dado: { ...dado, pagina: 3, paginaRecebimentos: 2, temProxima: true } });
    const meio = await render({ pagina: "3", paginaRecebimentos: "2" });
    expect(mocks.consulta).toHaveBeenLastCalledWith({ linhaId: "l/1", pagina: 3, paginaRecebimentos: 2, paginaPagadores: 1, paginaPropostas: 1 });
    expect(meio).toContain('href="/financeiro/migracao/l%2F1?pagina=2&amp;paginaRecebimentos=2">← Anterior');
    expect(meio).toContain('href="/financeiro/migracao/l%2F1?pagina=4&amp;paginaRecebimentos=2">Próxima');
    expect(meio).toContain('href="/financeiro/migracao/l%2F1?pagina=3">← Anterior');
    expect(meio).toContain('aria-label="Páginas de recebimentos"');
  });

  it("não consulta preferência nem fonte quando a guarda falha", async () => {
    mocks.guarda.mockRejectedValueOnce(new Error("negado"));
    await expect(Pagina({ params: Promise.resolve({ linhaId: "l" }), searchParams: Promise.resolve({}) })).rejects.toThrow("negado");
    expect(mocks.preferencia).not.toHaveBeenCalled();
    expect(mocks.consulta).not.toHaveBeenCalled();
  });
});
