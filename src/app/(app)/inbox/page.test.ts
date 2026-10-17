import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { ErroPermissaoFalso } = vi.hoisted(() => ({ ErroPermissaoFalso: class extends Error {} }));
const mocks = vi.hoisted(() => ({ sessao: vi.fn(), pagina: vi.fn(), item: vi.fn(), opcoes: vi.fn(), triagem: vi.fn(), revisoes: vi.fn(), preferencia: vi.fn(), admin: vi.fn(), filtro: vi.fn() }));
vi.mock("@/server/_shared", () => ({ exigirSessaoPagina: mocks.sessao, temPapel: mocks.admin, ErroPermissao: ErroPermissaoFalso }));
vi.mock("@/server/inbox/consultas-pagina", () => ({ listarAtendimentosPagina: mocks.pagina, obterItemListaInbox: mocks.item }));
vi.mock("@/server/whatsapp/operacoes-atendimento", () => ({ listarOpcoesAtendimento: mocks.opcoes, listarTriagemWhatsApp: mocks.triagem, listarRevisoesEnvio: mocks.revisoes }));
vi.mock("@/server/preferencias/fuso-exibicao", () => ({ consultarPreferenciaFusoEquipe: mocks.preferencia }));
vi.mock("@/server/inbox/opcoes-filtro", () => ({ opcoesFiltroInbox: mocks.filtro }));
vi.mock("./InboxNovo", () => ({ InboxNovo: ({ fuso, filtros, selecionado, inicial, triagem, revisoes, opcoesFiltro }: { opcoesFiltro?: { setores: string[]; numeros: { id: string }[] }; fuso: string | null; filtros: object; selecionado: string | null; triagem: unknown[] | null; revisoes: unknown[] | null; inicial: { proximo: string | null; itens: { id: string }[] } }) => `inbox:${fuso}|tri:${triagem === null ? "nao" : triagem.length}|rev:${revisoes === null ? "nao" : revisoes.length}|filtros:${JSON.stringify(filtros)}|sel:${selecionado}|prox:${inicial.proximo}|setores:${opcoesFiltro?.setores}|numeros:${opcoesFiltro?.numeros.map((n) => n.id)}|itens:${inicial.itens.map((i) => i.id)}` }));
vi.mock("./NovoAtendimento", () => ({ NovoAtendimento: () => "novo-atendimento" }));

import Page from "./page";

const cursorValido = Buffer.from(JSON.stringify({ em: "2026-10-01T00:00:00.000Z", id: "x" })).toString("base64url");

describe("InboxPage", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.sessao.mockResolvedValue({ id: "secretaria", papeis: ["SECRETARIA_ACADEMICA"] });
    mocks.admin.mockReturnValue(false);
    mocks.triagem.mockResolvedValue([]); mocks.revisoes.mockResolvedValue([]);
    mocks.pagina.mockResolvedValue({ itens: [], proximo: null }); mocks.opcoes.mockResolvedValue({ destinos: [], numeros: [] });
    mocks.filtro.mockResolvedValue({ setores: ["SECRETARIA"], numeros: [{ id: "n1", rotulo: "Secretaria" }] });
  });

  it("entrega ao InboxNovo os setores e números do PainelFiltros, consultados com o usuário da sessão", async () => {
    mocks.preferencia.mockResolvedValue({ ok: false });
    const h = renderToStaticMarkup(await Page({ searchParams: Promise.resolve({}) }));
    expect(h).toContain("setores:SECRETARIA|numeros:n1");
    expect(mocks.filtro).toHaveBeenCalledWith({ id: "secretaria", papeis: ["SECRETARIA_ACADEMICA"] });
  });

  it("encaminha a preferência somente depois da guarda", async () => {
    mocks.preferencia.mockResolvedValue({ ok: true, dado: { fusoExibicao: "America/Costa_Rica" } });
    expect(renderToStaticMarkup(await Page({ searchParams: Promise.resolve({ c: "atendimento" }) }))).toContain("inbox:America/Costa_Rica");
    expect(mocks.sessao.mock.invocationCallOrder[0]).toBeLessThan(mocks.preferencia.mock.invocationCallOrder[0]!);
  });

  it("triagem vai a quem a consulta aceita (administrador ou responsável do número); a revisão de envio só ao administrador", async () => {
    mocks.preferencia.mockResolvedValue({ ok: false });
    mocks.triagem.mockResolvedValue([{ id: "m1" }]);
    mocks.revisoes.mockResolvedValue([{ id: "r1" }, { id: "r2" }]);
    const resp = renderToStaticMarkup(await Page({ searchParams: Promise.resolve({}) }));
    expect(resp).toContain("tri:1|rev:nao");
    expect(mocks.revisoes).not.toHaveBeenCalled();
    mocks.admin.mockReturnValue(true);
    expect(renderToStaticMarkup(await Page({ searchParams: Promise.resolve({}) }))).toContain("tri:1|rev:2");
  });

  it("quem a triagem recusa (ErroPermissao) abre o inbox sem o painel; outro erro propaga", async () => {
    mocks.preferencia.mockResolvedValue({ ok: false });
    mocks.triagem.mockRejectedValue(new ErroPermissaoFalso("restrito"));
    expect(renderToStaticMarkup(await Page({ searchParams: Promise.resolve({}) }))).toContain("tri:nao|rev:nao");
    mocks.triagem.mockRejectedValue(new Error("banco fora"));
    await expect(Page({ searchParams: Promise.resolve({}) })).rejects.toThrow("banco fora");
  });

  it("mantém UTC como fallback quando não há preferência válida", async () => {
    mocks.preferencia.mockResolvedValue({ ok: false, erro: "preferência indisponível" });
    expect(renderToStaticMarkup(await Page({ searchParams: Promise.resolve({}) }))).toContain("inbox:null");
  });

  it("não lê preferência nem lista se a guarda falhar", async () => {
    mocks.sessao.mockRejectedValue(new Error("negado"));
    await expect(Page({ searchParams: Promise.resolve({}) })).rejects.toThrow("negado");
    expect(mocks.preferencia).not.toHaveBeenCalled();
    expect(mocks.pagina).not.toHaveBeenCalled();
  });

  it("filtros e conversa da URL vão à consulta paginada e à tela; sem ?c= nada é selecionado", async () => {
    mocks.preferencia.mockResolvedValue({ ok: false });
    const html = renderToStaticMarkup(await Page({ searchParams: Promise.resolve({ busca: "  ana  ", setor: "FINANCEIRO", c: "x" }) }));
    expect(mocks.pagina).toHaveBeenCalledWith(expect.anything(), { busca: "ana", setor: "FINANCEIRO" }, null);
    expect(html).toContain("sel:x");
    expect(renderToStaticMarkup(await Page({ searchParams: Promise.resolve({}) }))).toContain("sel:null");
  });

  it("cursor válido da URL é repassado; inválido é ignorado", async () => {
    mocks.preferencia.mockResolvedValue({ ok: false });
    await Page({ searchParams: Promise.resolve({ cursor: cursorValido }) });
    expect(mocks.pagina).toHaveBeenLastCalledWith(expect.anything(), {}, cursorValido);
    await Page({ searchParams: Promise.resolve({ cursor: "lixo!" }) });
    expect(mocks.pagina).toHaveBeenLastCalledWith(expect.anything(), {}, null);
  });

  it("deep link fora da primeira página: o item é buscado por id e entra na lista", async () => {
    mocks.preferencia.mockResolvedValue({ ok: false });
    mocks.pagina.mockResolvedValue({ itens: [{ id: "p1" }], proximo: null });
    mocks.item.mockResolvedValue({ id: "x" });
    const html = renderToStaticMarkup(await Page({ searchParams: Promise.resolve({ c: "x" }) }));
    expect(mocks.item).toHaveBeenCalledWith(expect.anything(), "x");
    expect(html).toContain("itens:x,p1");
  });

  it("deep link já presente na página, ou fora do escopo, não duplica nem inventa item", async () => {
    mocks.preferencia.mockResolvedValue({ ok: false });
    mocks.pagina.mockResolvedValue({ itens: [{ id: "x" }], proximo: null });
    expect(renderToStaticMarkup(await Page({ searchParams: Promise.resolve({ c: "x" }) }))).toContain("itens:x<");
    expect(mocks.item).not.toHaveBeenCalled();
    mocks.pagina.mockResolvedValue({ itens: [{ id: "p1" }], proximo: null });
    mocks.item.mockResolvedValue(null);
    expect(renderToStaticMarkup(await Page({ searchParams: Promise.resolve({ c: "y" }) }))).toContain("itens:p1<");
  });
});
