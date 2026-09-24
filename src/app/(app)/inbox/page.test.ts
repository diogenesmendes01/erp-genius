import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ sessao: vi.fn(), conversas: vi.fn(), thread: vi.fn(), opcoes: vi.fn(), triagem: vi.fn(), revisoes: vi.fn(), preferencia: vi.fn() }));
vi.mock("@/server/_shared", () => ({ exigirSessaoPagina: mocks.sessao, temPapel: () => false }));
vi.mock("@/server/whatsapp/consultas", () => ({ listarConversasInbox: mocks.conversas, carregarThread: mocks.thread }));
vi.mock("@/server/whatsapp/operacoes-atendimento", () => ({ listarOpcoesAtendimento: mocks.opcoes, listarTriagemWhatsApp: mocks.triagem, listarRevisoesEnvio: mocks.revisoes }));
vi.mock("@/server/preferencias/fuso-exibicao", () => ({ consultarPreferenciaFusoEquipe: mocks.preferencia }));
vi.mock("./InboxCliente", () => ({ InboxCliente: ({ preferenciaFusoExibicao, busca, limitada }: { preferenciaFusoExibicao: string | null; busca: string; limitada: boolean }) => `inbox:${preferenciaFusoExibicao}|busca:${busca}|limitada:${limitada}` }));
vi.mock("./AtendimentosPainel", () => ({ AtendimentosPainel: ({ preferenciaFusoExibicao }: { preferenciaFusoExibicao: string | null }) => `triagem:${preferenciaFusoExibicao}` }));

import Page from "./page";

describe("InboxPage", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.sessao.mockResolvedValue({ id: "secretaria", papeis: ["SECRETARIA_ACADEMICA"] });
    mocks.conversas.mockResolvedValue({ itens: [], limitada: false }); mocks.thread.mockResolvedValue(null); mocks.opcoes.mockResolvedValue({ destinos: [], numeros: [] });
  });

  it("encaminha a preferência somente depois da guarda", async () => {
    mocks.preferencia.mockResolvedValue({ ok: true, dado: { fusoExibicao: "America/Costa_Rica" } });
    expect(renderToStaticMarkup(await Page({ searchParams: Promise.resolve({ c: "atendimento" }) }))).toContain("inbox:America/Costa_Rica");
    expect(mocks.sessao.mock.invocationCallOrder[0]).toBeLessThan(mocks.preferencia.mock.invocationCallOrder[0]!);
  });

  it("mantém UTC como fallback quando não há preferência válida", async () => {
    mocks.preferencia.mockResolvedValue({ ok: false, erro: "preferência indisponível" });
    expect(renderToStaticMarkup(await Page({ searchParams: Promise.resolve({}) }))).toContain("inbox:null");
  });

  it("não lê preferência ou atendimentos se a guarda falhar", async () => {
    mocks.sessao.mockRejectedValue(new Error("negado"));
    await expect(Page({ searchParams: Promise.resolve({}) })).rejects.toThrow("negado");
    expect(mocks.preferencia).not.toHaveBeenCalled();
    expect(mocks.conversas).not.toHaveBeenCalled();
  });

  it("busca da URL vai à consulta (servidor) e à tela; o aviso de lista cortada chega à tela", async () => {
    mocks.preferencia.mockResolvedValue({ ok: false });
    mocks.conversas.mockResolvedValue({ itens: [], limitada: true });
    const html = renderToStaticMarkup(await Page({ searchParams: Promise.resolve({ busca: "  ana  ", c: "x" }) }));
    expect(mocks.conversas).toHaveBeenCalledWith(expect.anything(), { busca: "ana" });
    expect(html).toContain("busca:ana|limitada:true");
  });
});
