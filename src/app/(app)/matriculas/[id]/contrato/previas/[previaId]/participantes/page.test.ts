import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ sessao: vi.fn(), previa: vi.fn(), formulario: vi.fn(), historico: vi.fn(), preferencia: vi.fn() }));
vi.mock("@/server/_shared", () => ({ exigirSessaoPagina: mocks.sessao }));
vi.mock("@/server/contratos/previas", () => ({ consultarPreviaContratual: mocks.previa }));
vi.mock("@/server/contratos/participantes", () => ({ consultarFormularioParticipantes: mocks.formulario, consultarConferenciasParticipantes: mocks.historico }));
vi.mock("@/server/preferencias/fuso-exibicao", () => ({ consultarPreferenciaFusoEquipe: mocks.preferencia }));
vi.mock("./Formulario", () => ({ FormularioParticipantes: () => null }));
vi.mock("./Evidencia", () => ({ EvidenciaParticipantes: () => null }));
vi.mock("./SeletorMaioridade", () => ({ SeletorMaioridade: ({ maioridade }: { maioridade: string | null }) => `maioridade=${maioridade ?? "pendente"}` }));

import ParticipantesPage from "./page";
import { FormularioParticipantes } from "./Formulario";
import { identidadeNoReact } from "@/test/tela-sem-dom";

const pagina = (sp: Record<string, string>) => ParticipantesPage({ params: Promise.resolve({ id: "m1", previaId: "pv1" }), searchParams: Promise.resolve(sp) });

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
  const render = async (sp: Record<string, string>) => renderToStaticMarkup(await pagina(sp));

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

// docs/43 §6 item 3 (docs/42 L629): a maioridade era um <form method="get"> que navegava, e a key do formulário
// tinha a versão e a maioridade — trocar a classificação apagava todo o preenchimento dos signatários.
describe("participantes da prévia — o formulário não remonta", () => {
  const dados = (maioridade: "MAIOR" | "MENOR" | null, versaoEsperada = 1) => ({
    matriculaId: "m1", previaId: "pv1", versaoEsperada, maioridade, documentos: [],
    plano: { pendencias: [], participantesExigidos: [] }, participantes: [],
  });
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.sessao.mockResolvedValue({});
    mocks.previa.mockResolvedValue({ ok: true, dado: { matriculaId: "m1" } });
    mocks.historico.mockResolvedValue({ ok: true, dado: { registros: [], temProxima: false } });
    mocks.preferencia.mockResolvedValue({ ok: true, dado: { fusoExibicao: "UTC" } });
  });

  it("mesma identidade no React ao trocar a maioridade, a página do histórico e a versão", async () => {
    mocks.formulario.mockResolvedValue({ ok: true, dado: dados(null) });
    const base = identidadeNoReact(await pagina({}), FormularioParticipantes);
    expect(base).not.toBeNull();
    expect(base!.key).toBeNull();
    mocks.formulario.mockResolvedValue({ ok: true, dado: dados("MENOR") });
    expect(identidadeNoReact(await pagina({ maioridade: "MENOR" }), FormularioParticipantes)).toEqual(base);
    expect(identidadeNoReact(await pagina({ maioridade: "MENOR", pagina: "2" }), FormularioParticipantes)).toEqual(base);
    mocks.formulario.mockResolvedValue({ ok: true, dado: dados("MAIOR", 2) });
    expect(identidadeNoReact(await pagina({ maioridade: "MAIOR" }), FormularioParticipantes)).toEqual(base);
  });

  it("a classificação é um controle client-side (sem <form method=get>) que recebe a maioridade da URL", async () => {
    mocks.formulario.mockResolvedValue({ ok: true, dado: dados("MENOR") });
    const html = renderToStaticMarkup(await pagina({ maioridade: "MENOR" }));
    expect(html).toContain("maioridade=MENOR");
    expect(html).not.toContain('method="get"');
    expect(html).not.toContain("<form");
  });
});
