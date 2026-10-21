import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  sessao: vi.fn(async () => ({ id: "prof", nome: "P", papeis: ["PROFESSOR"] })),
  aulas: vi.fn(async () => ({ aulas: [] as unknown[], proximo: null as string | null })),
  diario: vi.fn((props: { mensagemVazio?: string; fusoEntrada?: string }) => createElement("section", { "data-vazio": props.mensagemVazio ?? "", "data-fuso": props.fusoEntrada ?? "" })),
  preferencia: vi.fn(async () => ({ ok: true, dado: { fusoExibicao: null as string | null } })),
}));
vi.mock("@/server/_shared", () => ({ exigirSessaoPagina: mocks.sessao }));
vi.mock("@/server/diario/consultas", () => ({ listarAulasDiario: mocks.aulas, listarTurmasParaDiario: async () => [] }));
vi.mock("./DiarioAulas", () => ({ DiarioAulas: mocks.diario }));
// Lote 3 do fuso pessoal: a página resolve o fuso de entrada da data da aula (pessoal; sem preferência, o da escola).
vi.mock("@/server/preferencias/fuso-exibicao", () => ({ consultarPreferenciaFusoEquipe: mocks.preferencia }));
vi.mock("@/server/relatorios/atendimento", () => ({ fusoDaEscola: async () => "America/Sao_Paulo" }));

import Page from "./page";

const render = async (params: Record<string, string>) => renderToStaticMarkup(await Page({ searchParams: Promise.resolve(params) }));

describe("/diario — fuso de entrada da data da aula (lote 3 do fuso pessoal)", () => {
  it("sem preferência, o da escola; com preferência, a pessoal", async () => {
    expect(await render({})).toContain('data-fuso="America/Sao_Paulo"');
    mocks.preferencia.mockResolvedValueOnce({ ok: true, dado: { fusoExibicao: "America/Costa_Rica" } });
    expect(await render({})).toContain('data-fuso="America/Costa_Rica"');
  });
});

describe("/diario — busca no histórico (E4)", () => {
  beforeEach(() => { vi.clearAllMocks(); mocks.aulas.mockResolvedValue({ aulas: [], proximo: null }); });

  it("formulário GET de busca; a busca e o cursor chegam à consulta", async () => {
    const html = await render({ busca: " verbos ", antes: "a1" });
    expect(mocks.aulas).toHaveBeenCalledWith(expect.anything(), "a1", "verbos");
    expect(html).toMatch(/<form method="get" action="\/diario" role="search"/);
    expect(html).toContain('value="verbos"');
    expect(html).toContain("Limpar busca");
  });

  it("paginação mantém a busca (anteriores e recentes)", async () => {
    mocks.aulas.mockResolvedValue({ aulas: [{}], proximo: "a9" });
    const html = await render({ busca: "verbos", antes: "a1" });
    expect(html).toContain('href="/diario?busca=verbos&amp;antes=a9"');
    expect(html).toContain('href="/diario?busca=verbos">Aulas recentes</a>');
    expect(html).toContain('aria-label="Páginas do histórico do diário"');
  });

  it("as sub-seções ficam nas abas do layout (E2): a página só leva às Avaliações, que são do acadêmico", async () => {
    const html = await render({});
    const hrefs = [...html.matchAll(/<a[^>]*\shref="([^"]+)"/g)].map((m) => m[1]);
    expect(hrefs.filter((h) => /^\/diario\/./.test(h))).toEqual([]);
    expect(hrefs).toContain("/academico/avaliacoes");
  });

  it("busca sem resultado diz o termo; sem busca, a mensagem padrão do histórico", async () => {
    expect(await render({ busca: "zé" })).toContain('data-vazio="Nenhuma aula para “zé”."');
    expect(await render({})).toContain('data-vazio=""');
  });
});
