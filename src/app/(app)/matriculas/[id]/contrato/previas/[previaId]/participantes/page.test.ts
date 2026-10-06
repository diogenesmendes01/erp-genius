import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ sessao: vi.fn(), previa: vi.fn(), formulario: vi.fn(), historico: vi.fn(), preferencia: vi.fn() }));
vi.mock("@/server/_shared", () => ({ exigirSessaoPagina: mocks.sessao }));
vi.mock("@/server/contratos/previas", () => ({ consultarPreviaContratual: mocks.previa }));
vi.mock("@/server/contratos/participantes", () => ({ consultarFormularioParticipantes: mocks.formulario, consultarConferenciasParticipantes: mocks.historico }));
vi.mock("@/server/preferencias/fuso-exibicao", () => ({ consultarPreferenciaFusoEquipe: mocks.preferencia }));
vi.mock("./Formulario", () => ({ FormularioParticipantes: () => null }));
vi.mock("./Evidencia", () => ({ EvidenciaParticipantes: () => null }));

import ParticipantesPage from "./page";

// Revisão R1 da #134 (B5): o histórico pagina junto com o filtro de maioridade da tela — a volta ao
// início preserva a maioridade escolhida.
describe("participantes da prévia — vazio paginado do histórico", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.sessao.mockResolvedValue({});
    mocks.previa.mockResolvedValue({ ok: true, dado: { matriculaId: "m1" } });
    mocks.formulario.mockResolvedValue({ ok: true, dado: null });
    mocks.historico.mockResolvedValue({ ok: true, dado: { registros: [], temProxima: false } });
    mocks.preferencia.mockResolvedValue({ ok: true, dado: { fusoExibicao: "UTC" } });
  });
  const render = async (sp: Record<string, string>) =>
    renderToStaticMarkup(await ParticipantesPage({ params: Promise.resolve({ id: "m1", previaId: "pv1" }), searchParams: Promise.resolve(sp) }));

  it("página 1: afirma que não há conferência, sem 'nesta página' nem volta", async () => {
    const html = await render({ maioridade: "MENOR" });
    expect(html).toContain("Nenhuma conferência de participantes registrada para esta prévia.");
    expect(html).not.toContain("nesta página");
    expect(html).not.toContain("Ir para a primeira página");
  });

  it("página seguinte: texto de página e volta ao início com a maioridade escolhida", async () => {
    const html = await render({ maioridade: "MENOR", pagina: "3" });
    expect(html).toContain("Nenhuma conferência registrada nesta página.");
    expect(html).toContain('<a href="?pagina=1&amp;maioridade=MENOR">Ir para a primeira página</a>');
  });
});
