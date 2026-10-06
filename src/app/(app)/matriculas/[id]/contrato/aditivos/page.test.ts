import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ sessao: vi.fn(), aditivos: vi.fn(), agenda: vi.fn(), preferencia: vi.fn() }));
vi.mock("@/server/_shared", () => ({ exigirSessaoPagina: mocks.sessao }));
vi.mock("@/server/contratos/aditivos", () => ({ consultarAditivosContratuais: mocks.aditivos }));
vi.mock("@/server/contratos/agenda-aditivo", () => ({ consultarPropostaAgendaAditivo: mocks.agenda }));
vi.mock("@/server/preferencias/fuso-exibicao", () => ({ consultarPreferenciaFusoEquipe: mocks.preferencia }));
vi.mock("../CadastroContratualAplicado", () => ({ CadastroContratualAplicado: () => null }));
vi.mock("./Formularios", () => ({ PrepararAditivo: () => null }));

import AditivosPage from "./page";

// Revisão R1 da #134 (B5): modelos e propostas na mesma tela — página 1 afirma ausência; a volta de
// uma lista preserva a página da outra.
describe("aditivos contratuais — vazios paginados", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.sessao.mockResolvedValue({});
    mocks.preferencia.mockResolvedValue({ ok: true, dado: { fusoExibicao: "UTC" } });
  });
  const render = async (pagina: number, paginaModelos: number, sp: Record<string, string>) => {
    mocks.aditivos.mockResolvedValue({ ok: true, dado: {
      matricula: { aluno: "Ana" }, fonte: { artefatoId: "art", ambiente: "PRODUCAO" }, modelos: [], paginaModelos, maisModelos: false,
      propostas: [], pagina, maisPropostas: false, cadastroContratual: null,
    } });
    return renderToStaticMarkup(await AditivosPage({ params: Promise.resolve({ id: "m1" }), searchParams: Promise.resolve(sp) }));
  };

  it("página 1 das duas listas: afirma ausência, sem 'nesta página' nem volta", async () => {
    const html = await render(1, 1, {});
    expect(html).toContain("Nenhum modelo de aditivo aprovado está disponível.");
    expect(html).toContain("Nenhuma proposta de aditivo registrada para esta matrícula.");
    expect(html).not.toContain("nesta página");
    expect(html).not.toContain("Ir para a primeira página");
  });

  it("páginas seguintes: cada volta preserva a página da outra lista", async () => {
    const html = await render(4, 2, { pagina: "4", modelos: "2" });
    expect(html).toContain("Nenhum modelo de aditivo aprovado está disponível nesta página.");
    expect(html).toContain('href="/matriculas/m1/contrato/aditivos?modelos=1&amp;pagina=4">Ir para a primeira página</a>');
    expect(html).toContain("Nenhuma proposta nesta página.");
    expect(html).toContain('href="/matriculas/m1/contrato/aditivos?pagina=1&amp;modelos=2">Ir para a primeira página</a>');
  });
});
