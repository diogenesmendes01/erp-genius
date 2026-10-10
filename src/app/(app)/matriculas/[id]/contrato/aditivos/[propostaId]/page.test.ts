import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ sessao: vi.fn(), proposta: vi.fn(), efeitos: vi.fn(), preferencia: vi.fn(), acerto: vi.fn(), historico: vi.fn(), originais: vi.fn() }));
vi.mock("@/server/_shared", () => ({ exigirSessaoPagina: mocks.sessao }));
vi.mock("@/server/contratos/aditivos", () => ({ consultarPropostaAditivo: mocks.proposta }));
vi.mock("@/server/contratos/aditivo-efeitos-consulta", () => ({ consultarEfeitosAditivo: mocks.efeitos }));
vi.mock("@/server/preferencias/fuso-exibicao", () => ({ consultarPreferenciaFusoEquipe: mocks.preferencia }));
vi.mock("@/server/contratos/aditivo-acerto-taxa-consulta", () => ({ consultarAcertoTaxaPorProposta: mocks.acerto }));
vi.mock("../Formularios", () => ({ DecidirAditivo: () => null }));
vi.mock("../ParticipantesFormulario", () => ({ ParticipantesFormulario: () => null }));
vi.mock("../ImpactosPainel", () => ({ ImpactosPainel: () => null }));
vi.mock("../AcertoTaxaFormulario", () => ({ AcertoTaxaFormulario: () => null }));
vi.mock("../ImpactosTaxaFormulario", () => ({ ImpactosTaxaFormulario: () => null }));
vi.mock("./EstadoCampo", () => ({ EstadoCampo: () => null }));
vi.mock("../ParticipantesHistorico", () => ({ ParticipantesHistorico: (props: unknown) => { mocks.historico(props); return null; } }));
vi.mock("../OriginaisPainel", () => ({ OriginaisPainel: (props: unknown) => { mocks.originais(props); return null; } }));

import PropostaAditivoPage from "./page";

// Revisão R2 da #134 (B4): os dois painéis paginados dividem a URL. Cada um recebe a SUA página em
// `pagina` e a do outro na prop que preserva a outra lista; trocar a fiação faria um link de um painel
// mudar a página do outro.
describe("proposta de aditivo — fiação das páginas dos painéis", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.sessao.mockResolvedValue({ papeis: ["SECRETARIA_ACADEMICA"] });
    mocks.preferencia.mockResolvedValue({ ok: true, dado: { fusoExibicao: "UTC" } });
    mocks.efeitos.mockResolvedValue({ ok: false, erro: "Indisponível." });
    mocks.acerto.mockResolvedValue({ ok: false, erro: "Indisponível." });
    mocks.proposta.mockResolvedValue({ ok: true, dado: { id: "p1", versao: 1, preparadaPor: "Ana", criadaEm: "2026-10-01T10:00:00.000Z", motivo: "Ajuste", ambiente: "PRODUCAO", artefatoOriginalId: "a1", conclusaoOriginalId: "c1", documento: { titulo: "Aditivo", secoes: [] }, impactos: [], vigenciaInicio: "2026-11-01T00:00:00.000Z", alteracoes: [], superada: false, decisao: null, podeDecidir: false, propostaHash: "h" } });
  });
  const props = async (sp: Record<string, string>) => {
    renderToStaticMarkup(await PropostaAditivoPage({ params: Promise.resolve({ id: "m1", propostaId: "p1" }), searchParams: Promise.resolve(sp) }));
    const h = mocks.historico.mock.calls.at(-1)?.[0] as { pagina: number; paginaOriginais: number };
    const o = mocks.originais.mock.calls.at(-1)?.[0] as { pagina: number; paginaConferencias: number };
    return { historico: { pagina: h.pagina, paginaOriginais: h.paginaOriginais }, originais: { pagina: o.pagina, paginaConferencias: o.paginaConferencias } };
  };

  it("cada painel recebe a própria página e preserva a do outro", async () => {
    expect(await props({ paginaConferencias: "2", paginaOriginais: "5" })).toEqual({ historico: { pagina: 2, paginaOriginais: 5 }, originais: { pagina: 5, paginaConferencias: 2 } });
  });

  it("sem páginas na URL: ambos na primeira", async () => {
    expect(await props({})).toEqual({ historico: { pagina: 1, paginaOriginais: 1 }, originais: { pagina: 1, paginaConferencias: 1 } });
  });

  // docs/42 L691 (docs/43 §6 item 7): a mensagem das taxas não tinha link, e os acertos são telas do Financeiro.
  describe("acertos do Financeiro: link só para quem abre, motivo para a Secretaria", () => {
    const comAcertos = () => {
      mocks.efeitos.mockResolvedValue({ ok: true, dado: { vigenciaInicio: "2026-11-01T00:00:00.000Z", acertosTaxaAplicados: 0, efeitos: [], aplicacoesCampos: [], pendencias: [], aplicado: false,
        primeiraMensalidade: { vencimentoProposto: "2026-11-10", cobranca: { id: "cobranca-interna", versao: 3 }, pendencia: "Acerto pendente." } } });
      mocks.acerto.mockResolvedValue({ ok: true, dado: { estado: "PRONTA_PARA_SELECAO" } });
    };
    const html = async () => renderToStaticMarkup(await PropostaAditivoPage({ params: Promise.resolve({ id: "m1", propostaId: "p1" }), searchParams: Promise.resolve({}) }));

    it("Secretaria: sem link para /financeiro; diz quem faz e o que fazer", async () => {
      comAcertos();
      const tela = await html();
      expect(tela).not.toContain('href="/financeiro');
      expect(tela).toContain("O acerto do vencimento da primeira mensalidade é feito pelo Financeiro");
      expect(tela).toContain("A consulta individual das taxas está disponível para o Financeiro");
      expect(tela).toContain("Cobrança de origem: a primeira mensalidade emitida, na versão 3.");
      expect(tela).not.toContain("cobranca-interna");
    });

    it("Administração: os links dos dois acertos, inclusive o das taxas que faltava", async () => {
      mocks.sessao.mockResolvedValue({ papeis: ["ADMINISTRADOR"] });
      comAcertos();
      const tela = await html();
      expect(tela).toContain('href="/financeiro/acertos-vencimento/m1/p1"');
      expect(tela).toContain('href="/financeiro/acertos-taxa/m1/p1">Abrir o acerto das taxas no Financeiro</a>');
      expect(tela).not.toContain("Avise o Financeiro");
    });
  });
});
