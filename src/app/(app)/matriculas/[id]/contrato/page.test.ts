import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ sessao: vi.fn(), painel: vi.fn(), preenchimento: vi.fn(), preferencia: vi.fn() }));
vi.mock("@/server/_shared", () => ({ exigirSessaoPagina: mocks.sessao }));
vi.mock("@/server/contratos/previas", () => ({ consultarPainelPrevias: mocks.painel, consultarPreenchimentoContratual: mocks.preenchimento }));
vi.mock("@/server/preferencias/fuso-exibicao", () => ({ consultarPreferenciaFusoEquipe: mocks.preferencia }));
vi.mock("./TextoPrevia", () => ({ TextoPrevia: () => null }));
vi.mock("./RegistrarPrevia", () => ({ RegistrarPrevia: () => null }));

import ContratoPage from "./page";

// Revisão R1 da #134 (B5): duas listas na mesma tela (modelos e prévias) — página 1 afirma ausência;
// a página seguinte de uma volta ao início sem perder a página da outra.
describe("prévia contratual — vazios paginados", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.sessao.mockResolvedValue({});
    mocks.preferencia.mockResolvedValue({ ok: true, dado: { fusoExibicao: "UTC" } });
  });
  const render = async (paginaModelos: number, paginaHistorico: number, sp: Record<string, string>) => {
    mocks.painel.mockResolvedValue({ ok: true, dado: { matricula: { aluno: "Ana", codigo: "M1" }, podePreparar: true, modelos: [], paginaModelos, maisModelos: false, historico: [], paginaHistorico, maisHistorico: false } });
    return renderToStaticMarkup(await ContratoPage({ params: Promise.resolve({ id: "m1" }), searchParams: Promise.resolve(sp) }));
  };

  it("página 1 das duas listas: afirma ausência, sem 'nesta página' nem volta", async () => {
    const html = await render(1, 1, {});
    expect(html).toContain("Nenhum modelo publicado disponível para o regime da matrícula.");
    expect(html).toContain("Nenhuma prévia registrada para esta matrícula.");
    expect(html).not.toContain("nesta página");
    expect(html).not.toContain("Ir para a primeira página");
  });

  it("páginas seguintes: cada volta preserva a página da outra lista", async () => {
    const html = await render(3, 5, { modelos: "3", historico: "5" });
    expect(html).toContain("Nenhum modelo publicado disponível nesta página para o regime da matrícula.");
    expect(html).toContain('href="/matriculas/m1/contrato?modelos=1&amp;historico=5">Ir para a primeira página</a>');
    expect(html).toContain("Nenhuma prévia registrada nesta página.");
    expect(html).toContain('href="/matriculas/m1/contrato?historico=1&amp;modelos=3">Ir para a primeira página</a>');
  });

  it("só a lista de prévias além da primeira: modelos afirma ausência", async () => {
    const html = await render(1, 2, { historico: "2" });
    expect(html).toContain("Nenhum modelo publicado disponível para o regime da matrícula.");
    expect(html).toContain("Nenhuma prévia registrada nesta página.");
  });
});
