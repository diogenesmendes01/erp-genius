import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

// docs/43 §6 item 3 (docs/42 L2217): a key do formulário tinha a versão da oferta e as páginas de cadastros e
// de turmas — "Mais turmas" ou "Cadastros anteriores" remontavam o formulário e apagavam taxa, valor, motivo e a
// agenda conferida. Agora a key é só a oferta (outra oferta é outra contratação).
const mocks = vi.hoisted(() => ({ sessao: vi.fn(), cadastros: vi.fn(), ofertas: vi.fn() }));
vi.mock("@/server/_shared", () => ({ exigirSessaoPagina: mocks.sessao }));
vi.mock("@/server/matricula/preparacao-comercial", () => ({ consultarCadastrosPreparacao: mocks.cadastros, consultarOfertasPreparacao: mocks.ofertas }));
vi.mock("./PreparacaoFormulario", () => ({ PreparacaoFormulario: () => "formulario-de-preparacao" }));

import Page from "./page";
import { PreparacaoFormulario } from "./PreparacaoFormulario";
import { elementos, identidadeNoReact, texto } from "@/test/tela-sem-dom";

const cadastros = (pagina: number) => ({
  lead: { nome: "Ana" }, contatoConferivel: true, podeCadastrarNovo: false, matriculaId: null, paisesCadastro: [],
  candidatos: [{ id: `aluno-${pagina}`, primeiroNome: "Ana", sobrenome: `P${pagina}` }], pagina, possuiMais: true,
});
const ofertas = (paginaTurmas: number, versaoEntrada = 1, ofertaId = "oferta-1") => ({
  ofertas: [{ id: ofertaId, nome: "Inglês", moeda: "BRL" }], pagina: 1, possuiMais: false, prazoMinutos: 30,
  selecionada: { id: ofertaId, nome: "Inglês", moeda: "BRL", moedaCoerente: true, formaAgenda: null, versaoEntrada, produtoId: "produto", paisId: "pais" },
  turmas: [{ id: `turma-${paginaTurmas}`, nome: `Turma ${paginaTurmas}`, vagas: 3, elegivel: true }], paginaTurmas, possuiMaisTurmas: true,
});
const renderizar = (sp: Record<string, string>) => Page({ params: Promise.resolve({ id: "lead-1" }), searchParams: Promise.resolve(sp) });

describe("preparar contratação — o formulário não remonta", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.sessao.mockResolvedValue({ id: "vendedor" });
  });

  it("mesma identidade no React ao mudar a página de cadastros, a de turmas e a versão da oferta", async () => {
    mocks.cadastros.mockResolvedValue({ ok: true, dado: cadastros(1) });
    mocks.ofertas.mockResolvedValue({ ok: true, dado: ofertas(1) });
    const base = identidadeNoReact(await renderizar({ ofertaId: "oferta-1" }), PreparacaoFormulario);
    expect(base).toEqual({ caminho: expect.any(Array), key: "oferta-1" });
    mocks.cadastros.mockResolvedValue({ ok: true, dado: cadastros(2) });
    expect(identidadeNoReact(await renderizar({ ofertaId: "oferta-1", cadastros: "2" }), PreparacaoFormulario)).toEqual(base);
    mocks.ofertas.mockResolvedValue({ ok: true, dado: ofertas(2) });
    expect(identidadeNoReact(await renderizar({ ofertaId: "oferta-1", cadastros: "2", turmas: "2" }), PreparacaoFormulario)).toEqual(base);
    mocks.ofertas.mockResolvedValue({ ok: true, dado: ofertas(2, 7) });
    expect(identidadeNoReact(await renderizar({ ofertaId: "oferta-1", cadastros: "2", turmas: "2" }), PreparacaoFormulario)).toEqual(base);
  });

  it("outra oferta é outra contratação: a key muda (começa do zero)", async () => {
    mocks.cadastros.mockResolvedValue({ ok: true, dado: cadastros(1) });
    mocks.ofertas.mockResolvedValue({ ok: true, dado: ofertas(1, 1, "oferta-2") });
    expect(identidadeNoReact(await renderizar({ ofertaId: "oferta-2" }), PreparacaoFormulario)?.key).toBe("oferta-2");
  });

  it("a paginação de cadastros e de turmas não rola a tela de volta ao topo", async () => {
    mocks.cadastros.mockResolvedValue({ ok: true, dado: { ...cadastros(2), possuiMais: true } });
    mocks.ofertas.mockResolvedValue({ ok: true, dado: ofertas(2) });
    const arvore = await renderizar({ ofertaId: "oferta-1", cadastros: "2", turmas: "2" });
    expect(renderToStaticMarkup(arvore)).toContain("formulario-de-preparacao");
    const links = elementos(arvore).filter((n) => ["Cadastros anteriores", "Mais cadastros", "Turmas anteriores", "Mais turmas"].includes(texto(n.props.children)));
    expect(links.map((n) => texto(n.props.children)).sort()).toEqual(["Cadastros anteriores", "Mais cadastros", "Mais turmas", "Turmas anteriores"]);
    for (const l of links) expect(l.props.scroll, texto(l.props.children)).toBe(false);
  });
});
