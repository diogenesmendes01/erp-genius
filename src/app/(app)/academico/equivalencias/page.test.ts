import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ sessao: vi.fn(), listar: vi.fn(), preferencia: vi.fn() }));
vi.mock("@/server/_shared", () => ({
  exigirSessaoPagina: mocks.sessao,
  temPapel: (usuario: { papeis?: string[] }, papel: string) => usuario.papeis?.includes(papel) ?? false,
}));
vi.mock("@/server/avaliacoes/equivalencia-consulta", () => ({ listarPropostasEquivalencia: mocks.listar }));
vi.mock("@/server/preferencias/fuso-exibicao", () => ({ consultarPreferenciaFusoEquipe: mocks.preferencia }));
import Page from "./page";

const proposta = {
  id: "proposta-1",
  versao: 1,
  criadaEm: new Date("2026-10-01T02:30:00.000Z"),
  motivo: "Aproveitamento conferido.",
  turmaOrigem: { codigo: "A1", nome: null },
  turmaDestino: { codigo: "B1", nome: null },
  estado: "APROVADA",
};

const resultado = { ok: true, dado: { itens: [proposta], pagina: 1, temProxima: false } };

describe("listagem de equivalências", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.sessao.mockResolvedValue({ papeis: ["GERENTE_PEDAGOGICO"] });
    mocks.listar.mockResolvedValue(resultado);
    mocks.preferencia.mockResolvedValue({ ok: true, dado: { fusoExibicao: "America/Costa_Rica" } });
  });

  it("exibe o instante administrativo na preferência pessoal sem alterar o link de execução", async () => {
    const html = renderToStaticMarkup(await Page({ searchParams: Promise.resolve({ matriculaId: "matricula-1" }) }));

    expect(html).toContain("30/09/2026, 20:30");
    expect(html).toContain("horário exibido em America/Costa_Rica");
    expect(html).toContain('href="/academico/equivalencias/proposta-1"');
    expect(html).toContain("Conferir e efetivar autorização");
  });

  it("mantém São Paulo como referência de exibição quando não há preferência", async () => {
    mocks.preferencia.mockResolvedValue({ ok: false, erro: "Preferência indisponível" });

    const html = renderToStaticMarkup(await Page({ searchParams: Promise.resolve({ matriculaId: "matricula-1" }) }));

    expect(html).toContain("30/09/2026, 23:30");
    expect(html).toContain("horário exibido em America/Sao_Paulo");
  });

  it("não consulta propostas ou preferência antes da guarda", async () => {
    mocks.sessao.mockRejectedValue(new Error("Sem sessão"));

    await expect(Page({ searchParams: Promise.resolve({ matriculaId: "matricula-1" }) })).rejects.toThrow("Sem sessão");
    expect(mocks.listar).not.toHaveBeenCalled();
    expect(mocks.preferencia).not.toHaveBeenCalled();
  });

  describe("paginação nos dois sentidos (E4)", () => {
    const render = async (sp: Record<string, string>) => renderToStaticMarkup(await Page({ searchParams: Promise.resolve({ matriculaId: "matricula/1", ...sp }) }));

    it("primeira página: só Próxima, com a matrícula e sem link para si mesma", async () => {
      mocks.listar.mockResolvedValue({ ok: true, dado: { itens: [proposta], pagina: 1, temProxima: true } });
      const html = await render({});
      expect(mocks.listar).toHaveBeenCalledWith({ matriculaId: "matricula/1", pagina: 1 });
      expect(html).not.toContain("Anterior");
      expect(html).not.toContain("pagina=1");
      expect(html).toContain('href="/academico/equivalencias?matriculaId=matricula%2F1&amp;pagina=2">Próxima');
    });

    it("no meio: Anterior e Próxima na página certa, sem perder a matrícula; da segunda, Anterior volta sem ?pagina=1", async () => {
      mocks.listar.mockResolvedValue({ ok: true, dado: { itens: [proposta], pagina: 3, temProxima: true } });
      const meio = await render({ pagina: "3" });
      expect(mocks.listar).toHaveBeenCalledWith({ matriculaId: "matricula/1", pagina: 3 });
      expect(meio).toContain('href="/academico/equivalencias?matriculaId=matricula%2F1&amp;pagina=2">← Anterior');
      expect(meio).toContain('href="/academico/equivalencias?matriculaId=matricula%2F1&amp;pagina=4">Próxima');
      mocks.listar.mockResolvedValue({ ok: true, dado: { itens: [proposta], pagina: 2, temProxima: false } });
      const segunda = await render({ pagina: "2" });
      expect(segunda).toContain('href="/academico/equivalencias?matriculaId=matricula%2F1">← Anterior');
      expect(segunda).not.toContain("Próxima");
    });
  });

  // Revisão R1 da #134 (B1/B5): a fila de autorizadas é recortada da página; a página 1 só afirma
  // "nenhuma nesta matrícula" quando a lista inteira coube nela.
  describe("autorizações aguardando execução — vazio", () => {
    const rejeitadas = (n: number) => Array.from({ length: n }, (_, i) => ({ ...proposta, id: `p${i}`, estado: "REJEITADA" }));
    const render = async (sp: Record<string, string>) => renderToStaticMarkup(await Page({ searchParams: Promise.resolve({ matriculaId: "matricula-1", ...sp }) }));

    it("página 1 com mais páginas: não afirma ausência na matrícula", async () => {
      mocks.listar.mockResolvedValue({ ok: true, dado: { itens: rejeitadas(50), pagina: 1, temProxima: true } });
      const html = await render({});
      expect(html).toContain("Nenhuma proposta autorizada entre as mais recentes. Confira as próximas propostas.");
      expect(html).not.toContain("nesta matrícula.");
      expect(html).not.toContain("nesta página");
    });

    it("página 1 com a lista inteira: afirma que nenhuma aguarda execução na matrícula", async () => {
      mocks.listar.mockResolvedValue({ ok: true, dado: { itens: rejeitadas(2), pagina: 1, temProxima: false } });
      expect(await render({})).toContain("Nenhuma proposta autorizada aguarda execução nesta matrícula.");
    });

    it("página seguinte: texto de página e volta ao início com a matrícula", async () => {
      mocks.listar.mockResolvedValue({ ok: true, dado: { itens: rejeitadas(2), pagina: 2, temProxima: false } });
      const html = await render({ pagina: "2" });
      expect(html).toContain("Nenhuma proposta autorizada aguarda execução nesta página.");
      expect(html).toContain('<a class="inline-block underline" href="/academico/equivalencias?matriculaId=matricula-1">Ir para a primeira página</a>');
    });

    it("página vazia: só o vazio da lista, sem o da fila (e página seguinte não afirma ausência na matrícula)", async () => {
      mocks.listar.mockResolvedValue({ ok: true, dado: { itens: [], pagina: 1, temProxima: false } });
      const primeira = await render({});
      expect(primeira).toContain("Nenhuma proposta de aproveitamento foi encontrada para esta matrícula.");
      expect(primeira).not.toContain("Nenhuma proposta autorizada");
      const seguinte = await render({ pagina: "2" });
      expect(seguinte).toContain("Nenhuma proposta de aproveitamento nesta página.");
      expect(seguinte).not.toContain("encontrada para esta matrícula");
    });
  });
});
