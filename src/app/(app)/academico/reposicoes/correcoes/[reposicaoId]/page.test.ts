import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ sessao: vi.fn(), consulta: vi.fn(), preferencia: vi.fn(), componente: vi.fn() }));
vi.mock("@/server/_shared", () => ({ exigirSessaoPagina: mocks.sessao }));
vi.mock("@/server/diario/correcao-reposicao-consulta", () => ({ consultarCorrecoesConclusaoReposicao: mocks.consulta }));
vi.mock("@/server/preferencias/fuso-exibicao", () => ({ consultarPreferenciaFusoEquipe: mocks.preferencia }));
vi.mock("./CorrecoesConclusaoReposicao", () => ({ CorrecoesConclusaoReposicao: (props: unknown) => { mocks.componente(props); return null; } }));

import CorrecoesReposicao from "./page";

describe("correções da conclusão de reposição — página repassada ao componente", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.sessao.mockResolvedValue({ papeis: ["GERENTE_PEDAGOGICO"] });
    mocks.preferencia.mockResolvedValue({ ok: true, dado: { fusoExibicao: "UTC" } });
    mocks.consulta.mockResolvedValue({ ok: true, dado: { reposicao: { id: "r1", origem: { fuso: "UTC", inicio: "2026-10-01T10:00:00.000Z", fim: "2026-10-01T11:00:00.000Z" } }, conclusao: { id: "c1" }, versaoEsperada: 1, consultaHistorica: false, conclusaoSeguinteVersao: null, conclusaoAnteriorVersao: null, correcoes: [], proximaAntesVersao: null } });
  });
  const antesVersaoRepassada = async (sp: Record<string, string>) => {
    renderToStaticMarkup(await CorrecoesReposicao({ params: Promise.resolve({ reposicaoId: "r1" }), searchParams: Promise.resolve(sp) }));
    return (mocks.componente.mock.calls.at(-1)?.[0] as { antesVersao: unknown }).antesVersao;
  };

  it("primeira página (sem antesVersao na URL): o componente recebe undefined", async () => {
    expect(await antesVersaoRepassada({})).toBeUndefined();
  });

  it("página seguinte (antesVersao na URL): o componente recebe o número", async () => {
    expect(await antesVersaoRepassada({ antesVersao: "7" })).toBe(7);
  });
});
